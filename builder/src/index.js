"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const build_angular_1 = require("@angular-devkit/build-angular");
const architect_1 = require("@angular-devkit/architect");
const fs = require("fs");
const rxjs_1 = require("rxjs");
let entryPointPath;
exports.default = (0, architect_1.createBuilder)((options, ctx, transforms = {}) => {
    options.deleteOutputPath = false;
    validateOptions(options);
    const originalWebpackConfigurationFn = transforms.webpackConfiguration;
    transforms.webpackConfiguration = (config) => {
        patchWebpackConfig(config, options);
        return originalWebpackConfigurationFn ? originalWebpackConfigurationFn(config) : config;
    };
    const result = (0, build_angular_1.executeBrowserBuilder)(options, ctx, transforms);
    return result.pipe(((0, rxjs_1.tap)(() => {
        patchEntryPoint('');
    })));
});
function validateOptions(options) {
    const { pluginName, modulePath } = options;
    if (!modulePath) {
        throw Error('Please define modulePath!');
    }
    if (!pluginName) {
        throw Error('Please provide pluginName!');
    }
}
function patchWebpackConfig(config, options) {
    const pluginName = options.pluginName;
    // Producing single bundle
    delete config.entry.polyfills;
    delete config.entry['polyfills-es5'];
    delete config.optimization.runtimeChunk;
    delete config.optimization.splitChunks;
    delete config.entry.styles;
    config.externals = {
        rxjs: 'rxjs',
        '@angular/core': 'ng.core',
        '@angular/common': 'ng.common',
        '@angular/forms': 'ng.forms',
        '@angular/router': 'ng.router',
        tslib: 'tslib'
        // put here other common dependencies
    };
    const ngCompilerPluginInstance = config.plugins.find(x => x.constructor && x.constructor.name === 'AngularCompilerPlugin');
    if (ngCompilerPluginInstance) {
        ngCompilerPluginInstance._entryModule = options.modulePath;
    }
    entryPointPath = config.entry.main[0];
    const [modulePath, moduleName] = options.modulePath.split('#');
    const factoryPath = `${modulePath.includes('.') ? modulePath : `${modulePath}/${modulePath}`}.ngfactory`;
    const entryPointContents = `
    export * from '${modulePath}'
    export * from '${factoryPath}'
    import { ${moduleName}NgFactory } from '${factoryPath}';
    export default ${moduleName}NgFactory;

    `;
    // Output details
    config.output.filename = `${pluginName}.js`;
    config.output.library = pluginName;
    config.output.libraryTarget = 'umd';
    config.output.globalObject = `(typeof self !== 'undefined' ? self : this)`;
}
function patchEntryPoint(contents) {
    fs.writeFileSync(entryPointPath, contents);
}
