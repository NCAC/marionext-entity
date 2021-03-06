import EqualStack from "../EqualStack";
import {
  UnknownTypeError,
  ReservedWordForPrimaryKeyError,
  InvalidValidationError,
  InvalidKeyValidationError
} from "../errors";
import { invalidValuesAsString } from "../utils";

const FORBIDDEN_PRIMARY_KEYS = ["row", "primaryKey", "primaryValue"];

export type TInstanceOrT<T> = T extends new (...args: any) => any
  ? InstanceType<T>
  : T;

interface IObjectWithAnyKey {
  "*": any;
}

// output
type outputValue<T extends any> = TInstanceOrT<T> extends { TOutput: any }
  ? TInstanceOrT<T>["TOutput"]
  : never;
type outputData<T> = {
  readonly [key in keyof T]?: outputValue<T[key]>;
};

interface IOutputAnyData<T> {
  readonly [key: string]: outputValue<T>;
}

export type OutputType<T> = T extends IObjectWithAnyKey
  ? IOutputAnyData<T["*"]> & outputData<Omit<T, "*">>
  : outputData<T>;

// input
type inputValue<T extends any> = TInstanceOrT<T> extends { TInput: any }
  ? TInstanceOrT<T>["TInput"]
  : never;

type inputData<T> = {
  [key in keyof T]?: inputValue<T[key]>;
};

interface IInputAnyData<T> {
  [key: string]: inputValue<T>;
}

export type EntityInputType<T> = T extends IObjectWithAnyKey
  ? IInputAnyData<T["*"]> & inputData<Omit<T, "*">>
  : inputData<T>;

// json
type jsonValue<T extends any> = TInstanceOrT<T> extends { TJson: any }
  ? TInstanceOrT<T>["TJson"]
  : never;

interface IJsonAnyData<T> {
  [key: string]: jsonValue<T>;
}

type jsonData<T> = {
  [key in keyof T]?: jsonValue<T[key]>;
};

export type EntityJsonType<T> = T extends IObjectWithAnyKey
  ? IJsonAnyData<T["*"]> & jsonData<Omit<T, "*">>
  : jsonData<T>;

export interface IType {
  TOutput: any;
  TInput: any;
  TJson: any;
}

const Types: any = {};

export interface ITypeParams {
  key?: ((key: string) => boolean) | RegExp;
  type?: string;
  required?: boolean;
  primary?: boolean;
  prepare?: (value: any, key: string, model: any) => any;
  toJSON?: (value: any, stack: any) => any;
  clone?: (value: any, stack: any) => any;
  equal?: (selfValue: any, anotherValue: any, stack: any) => boolean;
  validate?: ((value: any, key: string) => boolean) | RegExp;
  enum?: any[];
  default?: any | (() => any);
  const?: boolean;
}

export class Type {
  static Model: any;

  static registerType(name: string, SomeType: new (...args: any) => Type) {
    Types[name] = SomeType;
  }

  // create type by params
  static create(description: any, key: string) {
    const isTypeHelper =
      typeof description === "function" && description.isTypeHelper === true;

    if (isTypeHelper) {
      description = description();
    }

    const isPlainDescription = description && description.type;

    // structure: {prop: "number"}
    // or
    // structure: {prop: ["number"]}
    // or
    // structure: {prop: SomeModel}
    // or
    // structure: {prop: {}}
    if (!isPlainDescription) {
      description = {
        type: description
      };
    }

    // prepare description: ["string"]
    // to { type: "array", element: {type: "string"} }
    for (const typeName in Types) {
      const SomeType = Types[typeName];

      // CustomType can use some variations for declare structure
      SomeType.prepareDescription(description, key);
    }

    // find CustomType by name
    const CustomType = Types[description.type];
    if (!CustomType) {
      throw new UnknownTypeError({
        key,
        type: description.type
      });
    }

    if (description.primary) {
      const Model = Type.Model;
      const isReserved =
        key in Model.prototype || FORBIDDEN_PRIMARY_KEYS.includes(key);

      if (isReserved) {
        throw new ReservedWordForPrimaryKeyError({ key });
      }
    }

    try {
      description = new CustomType(description);
    } catch (err) {
      err.message = key + ": " + err.message;
      throw err;
    }

    // structure must be static
    Object.freeze(description);

    return description;
  }

  // default behavior
  static prepareDescription(description: any, key: string) {
    // redefine me
    return description;
  }

  primary?: boolean;
  required: boolean;
  type: string;
  const: boolean = false;
  enum?: any[];

  constructor(params: ITypeParams) {
    if (params.primary) {
      this.primary = true;
    }

    this.type = params.type as string;
    this.required = params.required || params.primary || false;

    if (Array.isArray(params.enum)) {
      this.enum = params.enum;
    }

    // default can be: false, 0, or function
    if ("default" in params) {
      if (typeof params.default === "function") {
        this.default = params.default;
      } else {
        this.default = () => params.default;
      }
    }

    // custom prepare not null value, after default prepare
    if (typeof params.prepare === "function") {
      const prepareByType = this.prepare.bind(this);
      const customPrepare = params.prepare;

      this.prepare = (value, key, model) => {
        value = prepareByType(value, key, model);

        if (value != null) {
          value = customPrepare(value, key, model);
        }

        return value;
      };
    }

    if (typeof params.toJSON === "function") {
      this.toJSON = params.toJSON;
    }

    // custom validate by RegExp or function
    if ("validate" in params) {
      // validate by required, enum, "unique" (ArrayType)
      const validateByType = this.validate.bind(this);

      if (typeof params.validate === "function") {
        const customValidate = params.validate;

        this.validate = (value, modelKey) => {
          return (
            validateByType(value, modelKey) &&
            (value == null || customValidate(value, modelKey))
          );
        };
      } else if (params.validate instanceof RegExp) {
        const regExp = params.validate;

        this.validate = (value, modelKey) => {
          return (
            validateByType(value, modelKey) &&
            (value == null || regExp.test(value))
          );
        };
      } else {
        throw new InvalidValidationError({
          invalidValue: invalidValuesAsString(params.validate)
        });
      }
    }

    // validate key for models with "*"
    if ("key" in params) {
      const customValidateKey = params.key;

      if (customValidateKey instanceof RegExp) {
        this.validateKey = (modelKey) => {
          return customValidateKey.test(modelKey);
        };
      } else if (typeof customValidateKey === "function") {
        this.validateKey = customValidateKey;
      } else {
        throw new InvalidKeyValidationError({
          invalidValue: invalidValuesAsString(customValidateKey)
        });
      }
    }

    // don't change value
    if (params.const) {
      this.const = true;
    }

    if (params.clone) {
      this.clone = params.clone;
    }

    if (params.equal) {
      this.equal = params.equal;
    }
  }

  default() {
    return null;
  }

  validateKey(key: string) {
    return true;
  }

  validate(value: any, key: string): boolean {
    if (this.enum) {
      if (value != null) {
        return this.enum.includes(value);
      }
    }

    return true;
  }

  prepare(value: any, key: string, model: any): any {
    return value;
  }

  toJSON(value: any, stack: any): any {
    return value;
  }

  clone(value: any, stack?: EqualStack, parentModel?: any): any {
    return this.toJSON(value, stack);
  }

  typeAsString(): string {
    return this.type;
  }

  equal(selfValue: any, otherValue: any, stack: any): boolean {
    return selfValue === otherValue;
  }
}
