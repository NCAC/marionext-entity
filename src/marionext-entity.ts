// tslint:disable: max-classes-per-file
// tslint:disable: member-access

import { setLang } from "./errors";

import { Model } from "./Model";
import {
  MutableObject,
  ModelStructureType,
  AnyChildModel,
  AnyChildCollection,
  TModelOnlyEventMap,
  TModelEventMap,
  TCollectionEventMap
} from "./types";
import Collection from "./Collection";

import { IType, Type, EntityInputType } from "./type/Type";

import { IAnyType, AnyType } from "./type/AnyType";
import { IArrayType, ArrayType } from "./type/ArrayType";
import { IBooleanType, BooleanType } from "./type/BooleanType";
import { IDateType, DateType } from "./type/DateType";
import { MakeModelType, ModelType } from "./type/ModelType";
import { MakeCollectionType, CollectionType } from "./type/CollectionType";
import { INumberType, NumberType } from "./type/NumberType";
import { IObjectType, ObjectType } from "./type/ObjectType";
import { IStringType, StringType } from "./type/StringType";
import { IOrType, OrType } from "./type/OrType";
import { ICustomClassType, CustomClassType } from "./type/CustomClassType";

const returnParamsWithType: any = (type: any) => {
  const func = (params: any) => ({
    ...params,
    type
  });
  func.isTypeHelper = true;

  return func;
};

const DataTypes = {
  Number: returnParamsWithType("number") as INumberType,
  String: returnParamsWithType("string") as IStringType,
  Boolean: returnParamsWithType("boolean") as IBooleanType,
  Date: returnParamsWithType("date") as IDateType,
  Array: returnParamsWithType("array") as IArrayType<IType>,
  Object: returnParamsWithType("object") as IObjectType<IType>,
  Model: MakeModelType,
  Collection: MakeCollectionType,
  Or: returnParamsWithType("or") as IOrType<IType>,
  Any: returnParamsWithType("any") as IAnyType,
  CustomClass: returnParamsWithType("CustomClass") as ICustomClassType<any>
};

Type.registerType("*", AnyType);
Type.registerType("any", AnyType);
Type.registerType("array", ArrayType);
Type.registerType("boolean", BooleanType);
Type.registerType("date", DateType);
Type.registerType("model", ModelType);
Type.registerType("collection", CollectionType);
Type.registerType("number", NumberType);
Type.registerType("object", ObjectType);
Type.registerType("string", StringType);
Type.registerType("or", OrType);
Type.registerType("CustomClass", CustomClassType);

export * from "./types";
export {
  Model,
  Collection,
  DataTypes,
  EntityInputType,
  setLang,
  MutableObject,
  ModelStructureType,
  AnyChildModel,
  AnyChildCollection,
  TModelOnlyEventMap,
  TModelEventMap,
  TCollectionEventMap
};
export { IAnyType, AnyType };
export { IArrayType, ArrayType };
export { IBooleanType, BooleanType };
export { IDateType, DateType };
export { MakeModelType, ModelType };
export { MakeCollectionType, CollectionType };
export { INumberType, NumberType };
export { IObjectType, ObjectType };
export { IStringType, StringType };
export { IOrType, OrType };
export { ICustomClassType, CustomClassType };
