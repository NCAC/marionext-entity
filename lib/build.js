import { config } from "./config.js";
import fileSystem from "fs-extra";
import { log, duration } from "./utils.js";
import { throttle } from "lodash-es";
import { join, relative } from "path";
import chokidar from "chokidar";
import { rollup } from "rollup";
import rollupTypescript from "rollup-plugin-ts";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import vinylFileSystem from "vinyl-fs";
import prettier from "gulp-prettier";

/**
 * @var {rollup.inputOptions} inputOptions
 */
const inputOptions = {
  external: ["@ncac/marionext-types"],
  input: config.get("srcFile"),
  onwarn({ loc, frame, message }) {
    if (loc) {
      console.warn(`${loc.file} (${loc.line}:${loc.column}) ${message}`);
      if (frame) console.warn(frame);
    } else {
      console.warn(message);
    }
  },
  plugins: [
    nodeResolve(),
    rollupTypescript({
      tsconfig: join(config.get("rootPath"), "tsconfig.json")
    })
  ]
};

/**
 * @var {rollup.outputOptions} outputOptions
 */
const outputOptions = {
  file: config.get("outJsFile"),
  format: "esm"
};

function bundlePackage() {
  return new Promise((resolve, reject) => {
    fileSystem
      .ensureDir(config.get("distPath"))
      .then(() => {
        return rollup(inputOptions);
      })
      .catch((err) => {
        let errorMessage = "\n";
        Object.entries(err).forEach(([k, v]) => {
          if (typeof v !== "string") {
            v = JSON.stringify(v);
          }
          errorMessage += `
          * ${k}: ${v}
        `;
        });
        log.error(errorMessage);
        reject(err);
      })
      .then((bundle) => {
        return bundle.write(outputOptions);
      })
      .catch((err) => {
        let errorMessage = "\n";
        Object.entries(err).forEach(([k, v]) => {
          if (typeof v !== "string") {
            v = JSON.stringify(v);
          }
          errorMessage += `
          * ${k}: ${v}
        `;
        });
        log.error(errorMessage);
        reject(err);
      })
      .then(resolve);
  });
}

function prettyDtsFile() {
  return new Promise((resolve, reject) => {
    vinylFileSystem
      .src(config.get("outDtsFile"))
      .pipe(prettier())
      .pipe(vinylFileSystem.dest(config.get("distPath")))
      .on("error", reject)
      .on("end", resolve);
  });
}

function prettyOutJsFile() {
  return new Promise((resolve, reject) => {
    vinylFileSystem
      .src(config.get("outJsFile"))
      .pipe(prettier())
      .pipe(vinylFileSystem.dest(config.get("distPath")))
      .on("error", reject)
      .on("end", resolve);
  });
}

async function build() {
  try {
    await bundlePackage();
    log(
      `The file ${relative(
        config.get("rootPath"),
        config.get("outJsFile")
      )} has been succesfully bundled.`,
      duration(config.get("start"))
    );
    await prettyOutJsFile();
    return await prettyDtsFile();
  } catch (err) {
    log.error(err);
  }
}

function watch() {
  const watcher = chokidar.watch(
    join(config.get("rootPath"), "src", "**", "*.ts")
  );
  watcher.on("change", (updatedPath) => {
    log(`${updatedPath} has been updated, we rebuild ..`);
    config.update("start", process.hrtime());
    throttle(build, 250)();
  });
}

config.set("start", process.hrtime());
build().finally(() => {
  watch();
});
