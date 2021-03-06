

import {Type, IType, ITypeParams} from "./Type";
import {Model} from "../Model";
import {isObject, isPlainObject, isNaN} from "../utils";
import {CircularStructureToJSONError} from "../errors";
import EqualStack from "../EqualStack";

// tslint:disable-next-line: no-empty-interface
export interface IAnyTypeParams extends ITypeParams {
}

export interface IAnyType extends IType {
    (params: IAnyTypeParams): IAnyType;

    TOutput: any;
    TInput: any;
    TJson: any;
}

export class AnyType extends Type {
    toJSON(value: any, stack: any) {
        return value2json( value, stack );
    }

    clone(value: any, stack: EqualStack) {
        return clone(value, stack);
    }

    equal(selfValue: any, otherValue: any, stack: EqualStack) {
        return equal(selfValue, otherValue, stack);
    }
}

export function equal(selfValue: any, otherValue: any, stack: EqualStack) {
    if ( selfValue instanceof Date && otherValue instanceof Date ) {
        return +selfValue === +otherValue;
    }

    if ( selfValue instanceof RegExp && otherValue instanceof RegExp ) {
        return selfValue.toString() === otherValue.toString();
    }

    if ( Array.isArray(selfValue) && Array.isArray(otherValue) ) {
        if ( selfValue.length !== otherValue.length ) {
            return false;
        }

        // stop circular recursion
        const stacked = stack.get(selfValue);
        if ( stacked ) {
            return stacked === otherValue;
        }
        stack.add(selfValue, otherValue);
        

        
        for (let i = 0, n = selfValue.length; i < n; i++) {
            const selfItem = selfValue[ i ];
            const otherItem = otherValue[ i ];

            const isEqualItem = equal( selfItem, otherItem, stack );
            if ( !isEqualItem ) {
                return false;
            }
        }
        
        return true;
    }

    if ( isPlainObject(selfValue) && isPlainObject(otherValue) ) {
        // stop circular recursion
        const stacked = stack.get(selfValue);
        if ( stacked ) {
            return true;
        }
        stack.add(selfValue, otherValue);

        const selfObj = selfValue;
        const otherObj = otherValue;

        for (const key in selfObj) {
            const myValue = selfObj[ key ];
            const himValue = otherObj[ key ];
            const isEqual = equal( myValue, himValue, stack );
            
            if ( !isEqual ) {
                return false;
            }
        }

        // check additional keys from otherObj
        for (const key in otherObj) {
            if ( key in selfObj) {
                continue;
            }

            // exists unknown property for selfObj
            return false;
        }

        return true;
    }

    if ( selfValue instanceof Model && otherValue instanceof Model ) {
        const stacked = stack.get(selfValue);
        if ( stacked ) {
            return true;
        }
        stack.add( selfValue, otherValue );

        return selfValue.equal( otherValue, stack );
    }

    if ( isNaN(selfValue) && isNaN(otherValue) ) {
        return true;
    }

    return selfValue === otherValue;
}

export function value2json(value: any, stack: any): any {
    if ( value instanceof Date ) {
        return value.toISOString();
    }

    if ( value && typeof value.toJSON === "function" ) {
        if ( stack.includes(value) ) {
            throw new CircularStructureToJSONError({});
        }
        stack.push(value);
    
        return value.toJSON([...stack]);
    }

    if ( Array.isArray(value) ) {
        if ( stack.includes(value) ) {
            throw new CircularStructureToJSONError({});
        }
        stack.push(value);
    
        return value.map((item) =>
            value2json( item, [...stack] )
        );
    }

    if ( isObject(value) ) {
        if ( stack.includes(value) ) {
            throw new CircularStructureToJSONError({});
        }
        stack.push(value);

        
        const json: any = {};

        for (const key in value) {
            const item = value[ key ];

            json[ key ] = value2json( item, [...stack] );
        }

        return json;
    }

    return value;
}

export function clone(value: any, stack: EqualStack): any {
    if ( value instanceof Date ) {
        return new Date( +value );
    }

    if ( value instanceof Model ) {
        return value.clone(stack);
    }

    if ( Array.isArray(value) ) {
        return value.map((item) =>
            clone( item, stack )
        );
    }

    if ( isObject(value) ) {
        const cloneObj: any = {};

        for (const key in value) {
            const item = value[ key ];

            cloneObj[ key ] = clone( item, stack );
        }

        return cloneObj;
    }

    return value;
}
