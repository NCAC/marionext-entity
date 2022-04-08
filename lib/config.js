import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { isUndefined, isEmpty, has, get, set } from "lodash-es";
import fileSystem from "fs-extra";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootPath = join(__dirname, "..");
const pkg = fileSystem.readJSONSync("./package.json");

export class Config {
  constructor() {
    this.rootPath = rootPath;
    this.set("distPath", join(rootPath, "dist"));
    this.set("outJsFile", join(rootPath, pkg.main));
    this.set("outDtsFile", join(rootPath, pkg.types));
    this.set("srcFile", join(rootPath, pkg.src));
  }

  /**
   *
   * @param {string} key3
   * @param {any} value
   */
  set(key, value) {
    if (isUndefined(value) || isEmpty(value)) {
      const error = new Error(
        `You have not provided a valid value (${value}) for the path ${key}`
      );
      error.file = __filename;
      throw error;
    }
    if (this[key]) {
      const error = new Error(
        `Use the update method instead of set because the key ${key} has already a value`
      );
      error.file = __filename;
      throw error;
    }

    set(this, key, value);
  }

  /**
   *
   * @param {string} path
   */
  get(path) {
    if (!has(this, path)) {
      const error = new Error(
        `the path ${path} does not exist in config object`
      );
      error.file = __filename;
      throw error;
    }

    return get(this, path);
  }

  /**
   *
   * @param {string} key
   * @param {any} value
   */
  update(key, value) {
    if (!value) {
      const error = new Error(
        `You have not provided a valid value (${value}) for the path ${key}`
      );
      error.file = __filename;
      throw error;
    }
    set(this, key, value);
  }
}

export const config = new Config();
