import {
  Type,
  EntityInputType,
  OutputType,
  EntityJsonType,
  IType
} from "./type/Type";
import { Model } from "./Model";
import { Collection } from "./Collection";

export interface ISimpleObject extends Object {
  [propName: string]: any;
}

export type MutableObject<T extends ISimpleObject> = {
  -readonly [key in keyof T]: T[key];
};

export type ModelStructureType = {
  [key: string]: IType | (new (...args: any) => IType);
};

// export type TStructureType<Structure extends StructureType> = {
//   [K in keyof Structure]: Structure[K];
// };

export type ReadOnlyPartial<TData> = {
  readonly [key in keyof TData]?: TData[key];
};

/**
 * for `change` event
 * ----
 *
 */
export type TModelChangeEvent<
  ChildModelStructure extends ModelStructureType
> = {
  prev: OutputType<ChildModelStructure>;
  changes: ReadOnlyPartial<OutputType<ChildModelStructure>>;
};
export type TChangeEventHandler<
  ChildModelStructure extends ModelStructureType
> = (event: TModelChangeEvent<ChildModelStructure>) => void;

/**
 * for `change:key` event
 */
export type TModelChangeKeyEvent<
  ChildModel extends Model<ChildModel, ChildModelStructure>,
  ChildModelStructure extends ModelStructureType,
  Key extends keyof ChildModel["row"]
> = {
  prev: ChildModel["row"][Key];
  change: ChildModel["row"][Key];
};
export type TChangeKeyEventHandler<
  ChildModel extends Model<ChildModel, ChildModelStructure>,
  ChildModelStructure extends ModelStructureType,
  Key extends keyof ChildModel["row"]
> = (event: TModelChangeKeyEvent<ChildModel, ChildModelStructure, Key>) => void;

export type ChangeEventName<
  ChildModel extends Model<ChildModel, ChildModelStructure>,
  ChildModelStructure extends ModelStructureType,
  EventName extends keyof ChildModel["row"]
> = EventName extends string ? `change:${EventName}` : never;

export type TModelEventMap<
  ChildModel extends Model<ChildModel, ChildModelStructure>,
  ChildModelStructure extends ModelStructureType
> = {
  [Key in keyof ChildModel["row"] as ChangeEventName<
    ChildModel,
    ChildModelStructure,
    Key
  >]: TChangeKeyEventHandler<ChildModel, ChildModelStructure, Key>;
} & {
  change: TChangeEventHandler<ChildModelStructure>;
  all: (eventName: string, ...args: any[]) => void;
};

export type TModelOnlyEventMap<
  ChildModel extends Model<ChildModel, ChildModelStructure>,
  ChildModelStructure extends ModelStructureType
> = {
  [Key in keyof ChildModel["row"] as ChangeEventName<
    ChildModel,
    ChildModelStructure,
    Key
  >]: TChangeKeyEventHandler<ChildModel, ChildModelStructure, Key>;
} & {
  change: TChangeEventHandler<ChildModelStructure>;
};

export type TCollectionAddEvent<TCollection, ChildModel> = {
  type: "add";
  model: ChildModel;
  collection: TCollection;
};

export type TCollectionRemoveEvent<TCollection, ChildModel> = {
  type: "remove";
  model: ChildModel;
  collection: TCollection;
};

export type TAddEventHandler<
  ChildCollection extends Collection<
    ChildCollection,
    ChildModel,
    ChildModelStructure
  >,
  ChildModel extends Model<ChildModel, ChildModelStructure>,
  ChildModelStructure extends ModelStructureType
> = (event: TCollectionAddEvent<ChildCollection, ChildModel>) => void;

export type TRemoveEventHandler<
  ChildCollection extends Collection<
    ChildCollection,
    ChildModel,
    ChildModelStructure
  >,
  ChildModel extends Model<ChildModel, ChildModelStructure>,
  ChildModelStructure extends ModelStructureType
> = (event: TCollectionRemoveEvent<ChildCollection, ChildModel>) => void;

export type TCollectionEventMap<
  ChildCollection extends Collection<
    ChildCollection,
    ChildModel,
    ChildModelStructure
  >,
  ChildModel extends Model<ChildModel, ChildModelStructure>,
  ChildModelStructure extends ModelStructureType
> = {
  add: TAddEventHandler<ChildCollection, ChildModel, ChildModelStructure>;
  remove: TRemoveEventHandler<ChildCollection, ChildModel, ChildModelStructure>;
  all: (eventName: string, ...args: any[]) => void;
};

export interface AnyChildModel<
  ChildModelStructure extends ModelStructureType = ModelStructureType
> extends Model<AnyChildModel<ChildModelStructure>, ChildModelStructure> {
  [key: string]: any;
}

export interface AnyChildCollection<
  ChildModelStructure extends ModelStructureType = ModelStructureType,
  ChildCollection extends Collection<
    ChildCollection,
    AnyChildModel,
    ChildModelStructure
  > = Collection<any, AnyChildModel, ChildModelStructure>
> extends Collection<
    ChildCollection,
    AnyChildModel<ChildModelStructure>,
    ChildModelStructure
  > {
  [key: string]: any;
}
