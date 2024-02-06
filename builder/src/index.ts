import { BrowserBuilderOutput, executeBrowserBuilder, ExecutionTransformer } from '@angular-devkit/build-angular';
import { JsonObject } from '@angular-devkit/core';
import { createBuilder, BuilderContext } from '@angular-devkit/architect';
import * as webpack from "webpack"
import * as fs from 'fs'
import { config, Observable, tap } from 'rxjs';


interface Options extends JsonObject {
  /**
   * A string of the form `path/to/file#exportName` that acts as a path to include to bundle
   */
  modulePath: string;

  /**
   * A name of compiled bundle
   */
  pluginName: string;

  /**
   * A comma-delimited list of shared lib names used by current plugin
   */
}

let entryPointPath: string;

export default createBuilder((options: Options, ctx: BuilderContext, transforms: {
  webpackConfiguration?: ExecutionTransformer<webpack.Configuration>,
} = {}): Observable<BrowserBuilderOutput> => {

  options.deleteOutputPath = false;
  validateOptions(options);

  const originalWebpackConfigurationFn = transforms.webpackConfiguration;

  transforms.webpackConfiguration = (config: webpack.Configuration) => {

    patchWebpackConfig(config, options);

    return originalWebpackConfigurationFn ? originalWebpackConfigurationFn(config) : config;
  }

  const result = executeBrowserBuilder(options as any, ctx, transforms);




  return result.pipe((tap(() => {
    patchEntryPoint('')
  })));

})


function validateOptions(options: Options) {
  const { pluginName, modulePath } = options;

  if (!modulePath) {
    throw Error('Please define modulePath!');
  }

  if (!pluginName) {
    throw Error('Please provide pluginName!');
  }
}

function patchWebpackConfig(config: webpack.Configuration, options: Options) {

  const pluginName = options.pluginName

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

  const ngCompilerPluginInstance = config.plugins.find(
    x => x.constructor && x.constructor.name === 'AngularCompilerPlugin'
  );

  if (ngCompilerPluginInstance) {
    ngCompilerPluginInstance._entryModule = options.modulePath;
  }

  entryPointPath = config.entry.main[0];
  const [modulePath, moduleName] = options.modulePath.split('#');

  const factoryPath = `${modulePath.includes('.') ? modulePath : `${modulePath}/${modulePath}`
    }.ngfactory`;

  const entryPointContents = `
    export * from '${modulePath}'
    export * from '${factoryPath}'
    import { ${moduleName}NgFactory } from '${factoryPath}';
    export default ${moduleName}NgFactory;

    `

  // Output details
  config.output.filename = `${pluginName}.js`
  config.output.library = pluginName
  config.output.libraryTarget = 'umd'
  config.output.globalObject = `(typeof self !== 'undefined' ? self : this)`;

}

function patchEntryPoint(contents: string) {
  fs.writeFileSync(entryPointPath, contents);
}


