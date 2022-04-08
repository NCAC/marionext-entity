import { ObjectHash } from "@ncac/marionext-types";
import { _ } from "@ncac/marionext-lodash";
import { EventTrigger } from "@ncac/marionext-event";
import EqualStack from "./EqualStack";
import {
  Type,
  EntityInputType,
  OutputType,
  EntityJsonType,
  IType
} from "./type/Type";
import { invalidValuesAsString, isObject } from "./utils";
import Walker from "./Walker";
import {
  ModelStructureType,
  ChangeEventName,
  TModelEventMap,
  AnyChildModel
} from "./types";

import {
  UnknownPropertyError,
  ModelWithoutStructureError,
  InvalidKeyError,
  InvalidValueError,
  RequiredError,
  ConstValueError,
  DataShouldBeObjectError
} from "./errors";

/**
 * Events in Model
 *
 * event "change"
 * Model.trigger("change", {prev: the previous value, changes: the new values})
 * Model.trigger("change:prop", {prev: the previous value, changes: the new values})
 */

/**
 * `final` abstract class Model
 * -----
 */
export abstract class Model<
  ChildModel extends Model<ChildModel, ChildModelStructure>,
  ChildModelStructure extends ModelStructureType
> extends EventTrigger<
  ChildModel,
  TModelEventMap<ChildModel, ChildModelStructure>
> {
  static Type = Type;

  TInputData!: EntityInputType<ReturnType<ChildModel["structure"]>>;
  TInput!: EntityInputType<ReturnType<ChildModel["structure"]>> | this;
  TOutput!: this;
  TJson!: EntityJsonType<ReturnType<ChildModel["structure"]>>;
  row: OutputType<ReturnType<ChildModel["structure"]>>;

  // "id"
  primaryKey?: string;
  // value of id
  primaryValue?: number | string;

  parent?: AnyChildModel;

  cid: string;

  abstract structure(): {
    [key: string]: IType | (new (...args: any) => IType);
  };

  // This is a noop method intended to be overridden
  initialize() {}

  constructor(
    inputData?: EntityInputType<ReturnType<ChildModel["structure"]>>
  ) {
    super();
    this.prepareStructure();

    const defaultRow: any = {};
    for (const propKey in this.properties) {
      const key = propKey;

      if (key === "*") {
        continue;
      }

      const description = this.properties[key];

      // default value is null, or something from description
      let defaultValue = description.default();
      // default can be invalid
      defaultValue = description.prepare(defaultValue, key, this);

      defaultRow[key] = defaultValue;
    }

    this.row = Object.freeze(defaultRow);

    (this as any).isInit = true; // do not check const
    (this as unknown as ChildModel).set(inputData || ({} as any));
    delete (this as any).isInit;
    this.cid = _.uniqueId("mod");
    this.initialize.apply(this, arguments);
  }

  private properties: OutputType<ReturnType<ChildModel["structure"]>>;

  private prepareStructure(): void {
    if (this.constructor.prototype.hasOwnProperty("properties")) {
      return;
    }
    const constructor = this.constructor as typeof Model;
    const properties = constructor.prototype.structure();

    // for speedup constructor, saving structure to prototype
    (this.constructor as typeof Model).prototype.properties = properties;

    for (const key in this.properties) {
      const description = this.properties[key];

      this.properties[key] = Type.create(description, key);

      if (description.primary) {
        this.constructor.prototype.primaryKey = key;
      }
    }

    // structure must be static... really static
    Object.freeze(properties);
  }

  get<TKey extends keyof ChildModel["row"]>(
    this: ChildModel,
    key: TKey
  ): ChildModel["row"][TKey] {
    return this.row[key];
  }

  set(this: ChildModel, row: this["TInputData"], options?: ObjectHash) {
    options = options || {
      onlyValidate: false
    };

    const newData: ChildModel["row"] = {} as ChildModel["row"];
    const oldData = this.row;

    // clone old values in newData
    for (const key in oldData) {
      newData[key as unknown as keyof ChildModel["row"]] =
        oldData[key as unknown as keyof ChildModel["row"]];
    }

    const anyKeyDescription = this.properties["*"];

    for (const key in row) {
      let description = this.properties[key];

      if (!description) {
        if (anyKeyDescription) {
          description = anyKeyDescription;

          const isValidKey = description.validateKey(key);

          if (!isValidKey) {
            throw new InvalidKeyError({
              key
            });
          }
        } else {
          throw new UnknownPropertyError({
            propertyName: key
          });
        }
      }

      let value = row[key];

      // cast input value to expected format
      value = description.prepare(value, key, this);

      // validate by params
      const isValid = description.validate(value, key);
      if (!isValid) {
        const valueAsString = invalidValuesAsString(value);

        throw new InvalidValueError({
          key,
          value: valueAsString
        });
      }

      newData[key as unknown as keyof ChildModel["row"]] = value;
    }

    // modify by reference
    // because it conveniently
    this.prepare(newData);

    const changes: Partial<ChildModel["row"]> = {};
    for (const key in newData) {
      const anyKey: any = key;
      let description = this.properties[anyKey];
      if (!description) {
        description = anyKeyDescription;
      }

      let newValue = newData[key];
      const oldValue = oldData[key];

      // if field has type string,
      // then he must be string or null in anyway!
      if (this.prepare !== Model.prototype.prepare) {
        newValue = description.prepare(newValue, key, this);
      }

      if (oldValue !== newValue) {
        if (description.const) {
          if (!(this as any).isInit) {
            throw new ConstValueError({
              key
            });
          }
        }
      }
      if (description.required) {
        if (newValue == null) {
          throw new RequiredError({
            key
          });
        }
      }

      if (newValue !== oldValue) {
        changes[key] = newValue;
        newData[key] = newValue;
      }
    }

    const hasChanges = Object.keys(changes).length > 0;
    if (!hasChanges) {
      return;
    }

    // juniors love use model.row for set
    // stick on his hands
    Object.freeze(newData);

    this.validate(newData);

    // do not call emit and set newData
    if (options.onlyValidate) {
      return;
    }

    this.row = newData;

    if (this.primaryKey) {
      const primaryValue = this.row[this.primaryKey];
      (this as any)[this.primaryKey] = primaryValue;
      this.primaryValue = primaryValue;
    }

    for (const key in changes) {
      const changeKeyEvent = `change:${key}` as unknown as ChangeEventName<
        ChildModel,
        ChildModelStructure,
        keyof ChildModel["row"]
      >;

      // @ts-ignore
      this.trigger(changeKeyEvent, {
        prev: oldData[key],
        change: changes[key]
      });
    }

    // @ts-ignore
    this.trigger("change", {
      prev: oldData,
      changes: changes
    });
  }

  prepare(row: this["TInputData"]): void {
    // any calculations with row by reference
  }
  validate(row: this["TInputData"]): void {
    // for invalid row throw error here
  }

  prepareJSON(json: ChildModel["TJson"]): void {
    // any calculations with json by reference
  }

  isValid(this: ChildModel, row: this["TInputData"]): boolean {
    if (!isObject(row)) {
      throw new DataShouldBeObjectError({});
    }

    try {
      this.set(row, {
        onlyValidate: true
      });

      return true;
    } catch (err) {
      return false;
    }
  }

  toJSON(stack = []): this["TJson"] {
    const json: any = {};

    for (const key in this.row) {
      const description = this.getDescription(key);
      let value = this.row[key];

      if (value != null) {
        value = description.toJSON(value, [...stack]);
      }

      json[key] = value;
    }

    this.prepareJSON(json);

    return json;
  }

  equal(otherModel: this | this["row"], stack?: any): boolean {
    stack = stack || new EqualStack();

    for (const key in this.row) {
      const anyKey = key as any;
      const description = this.getDescription(key);
      const selfValue = this.row[anyKey];
      const otherValue =
        otherModel instanceof Model
          ? otherModel.row[anyKey]
          : otherModel[anyKey];

      const isEqual = description.equal(selfValue, otherValue, stack);

      if (!isEqual) {
        return false;
      }
    }

    // check additional keys from other model
    const otherData = otherModel instanceof Model ? otherModel.row : otherModel;
    for (const key in otherData) {
      if (key in this.row) {
        continue;
      }

      // exists unknown property for self model
      return false;
    }

    return true;
  }

  hasProperty<Key extends keyof this["row"]>(key: Key): boolean {
    return this.row.hasOwnProperty(key);
  }

  hasValue<Key extends keyof this["row"]>(key: Key): boolean {
    const value = this.row[key];

    if (value == null) {
      return false;
    } else {
      return true;
    }
  }

  walk(
    this: ChildModel,
    iteration: (model: AnyChildModel, walker: Walker) => void,
    stack?: any
  ) {
    stack = stack || [];

    for (const key in this.row) {
      const value = this.row[key];

      let elements = [value];

      const isModelsArray = Array.isArray(value) && value[0] instanceof Model;
      const isCollection =
        value &&
        Array.isArray(value.models) &&
        value.models[0] instanceof Model;

      if (isModelsArray) {
        elements = value;
      } else if (isCollection) {
        elements = value.models;
      }

      for (let i = 0, n = elements.length; i < n; i++) {
        const element = elements[i] as any;

        if (element instanceof Model) {
          const model = element;

          // stop circular recursion
          if (stack.includes(model)) {
            continue;
          }
          stack.push(model);

          // api for stop and skip elements
          const walker = new Walker();

          // callback
          iteration(model, walker);

          // inside iteration we call walker.exit();
          if (walker.isExited()) {
            return;
          }

          // inside iteration we call walker.continue();
          if (walker.isContinued()) {
            continue;
          }

          // recursion
          model.walk(iteration, stack);
        }
      }
    }
  }

  findChild(
    this: ChildModel,
    iteration: (model: AnyChildModel) => boolean
  ): AnyChildModel | undefined {
    let child: AnyChildModel | undefined;

    this.walk((model, walker) => {
      const result = iteration(model);

      if (result) {
        child = model;
        walker.exit();
      }
    });

    return child;
  }

  filterChildren(
    this: ChildModel,
    iteration: (model: AnyChildModel) => boolean
  ): Array<AnyChildModel> {
    const children: Array<AnyChildModel> = [];

    this.walk((model) => {
      const result = iteration(model);

      if (result) {
        children.push(model);
      }
    });

    return children;
  }

  filterChildrenByInstance<TModel extends AnyChildModel>(
    this: ChildModel,
    SomeModel: new (...args: any) => TModel
  ): TModel[] {
    return this.filterChildren(
      (model) => model instanceof SomeModel
    ) as TModel[];
  }

  findParent(
    iteration: (model: AnyChildModel) => boolean,
    stack?: any
  ): AnyChildModel | undefined {
    stack = stack || [];

    let parent = this.parent;

    while (parent) {
      // stop circular recursion
      if (stack.includes(parent)) {
        return;
      }
      stack.push(parent);

      const result = iteration(parent);

      if (result) {
        return parent;
      }

      parent = parent.parent;
    }
  }

  filterParents(
    iteration: (model: AnyChildModel) => boolean
  ): Array<AnyChildModel> {
    const parents: Array<AnyChildModel> = [];
    let parent = this.parent;

    while (parent) {
      const result = iteration(parent);

      if (result) {
        parents.push(parent);
      }

      parent = parent.parent;
    }

    return parents;
  }

  findParentInstance<TModel extends Model<any, any>>(
    SomeModel: new (...args: any) => TModel
  ): TModel {
    return this.findParent((model) => model instanceof SomeModel) as TModel;
  }

  getDescription<Key extends keyof this["row"]>(key: Key) {
    const iKey = key;
    return this.properties[iKey] || this.properties["*"];
  }

  clone(stack?: EqualStack): this {
    stack = stack || new EqualStack();

    // circular reference
    const existsClone = stack.get(this);
    if (existsClone) {
      return existsClone;
    }

    const clone: this = Object.create(this.constructor.prototype);
    stack.add(this, clone);

    const cloneData: Partial<this["row"]> = {};

    for (const key in this.row) {
      const description = this.getDescription(key);
      let value = this.row[key];

      if (value != null) {
        value = description.clone(value, stack, clone);
      }

      cloneData[key] = value;
    }

    (clone as any).row = Object.freeze(cloneData);

    return clone;
  }
}

// for js
(Model as any).prototype.structure = function () {
  throw new ModelWithoutStructureError({
    className: this.constructor.name
  });
};

Type.Model = Model;

/**
 * TEST

const TestModelStructure = {
  propA: DataTypes.String,
  propB: DataTypes.Boolean
} as const;

type TTestModelStructure = typeof TestModelStructure;

class TestModel extends Model<TestModel, TTestModelStructure> {
  structure() {
    return TestModelStructure;
  }
}

const testModel = new TestModel({ propA: "ok", propB: true });
testModel.on("change:propA", (e) => {
  console.log(e.prev); // string OK
  console.log(e.change); // string OK
});
testModel.on("change:propB", (e) => {
  console.log(e.change); // boolean OK
  console.log(e.prev); // boolean OK
});
testModel.on("change", (e) => {
  console.log(e.changes);
  console.log(e.prev);
});
testModel.trigger("change", { prev: {}, changes: {} });

let testTriggerEvent: TChangeEvent<
  TestModel,
  {
    readonly propA: IStringType;
    readonly propB: IBooleanType;
  }
> = {
  prev: {
    propB: false
  },
  changes: {}
};

*/
