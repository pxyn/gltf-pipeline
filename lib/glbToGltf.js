'use strict';
var parseGlb = require('./parseGlb');
var processGltf = require('./processGltf');

module.exports = glbToGltf;

/**
 * Convert a glb to glTF.
 *
 * @param {Buffer} glb A buffer containing the glb contents.
 * @param {Object} [options] The same options object as {@link processGltf}
 * @returns {Promise} A promise that resolves to an object containing a glTF asset.
 */
function glbToGltf(glb, options) {
    var gltf = parseGlb(glb);
    return processGltf(gltf, options);
}
