const ModuleFederationPlugin = require("webpack/lib/container/ModuleFederationPlugin");
const mf = require("@angular-architects/module-federation/webpack");
const path = require("path");

module.exports = {
  output: {
    uniqueName: "ngx-snake"
  },
  optimization: {
    // Only needed to bypass a temporary bug
    runtimeChunk: false
  },
  plugins: [
    new ModuleFederationPlugin({
      
        // For remotes (please adjust)
        name: "strategy",
        filename: "remoteEntry.js",
        exposes: {
          "./Strategy": "./src/app/strategy/custom.strategy.ts",
        },        
        
        shared: {
          "@angular/core": { singleton: true, strictVersion: true }, 
          "@angular/common": { singleton: true, strictVersion: true }, 
          "@angular/router": { singleton: true, strictVersion: true },
        }
        
    })
  ],
};
