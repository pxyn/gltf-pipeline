'use strict';
var Cesium = require('cesium');
var fsExtra = require('fs-extra');
var path = require('path');
var Promise = require('bluebird');
var addPipelineExtras = require('./addPipelineExtras');
var dataUriToBuffer = require('./dataUriToBuffer');
var ForEach = require('./ForEach');

var defined = Cesium.defined;
var defaultValue = Cesium.defaultValue;
var isDataUri = Cesium.isDataUri;
var RuntimeError = Cesium.RuntimeError;

module.exports = readResources;

/**
 * Read data uris, buffer views, or files referenced by the glTF into buffers.
 * The buffer data is placed into extras._pipeline.source for the corresponding object.
 * This stage runs before updateVersion and handles both glTF 1.0 and glTF 2.0 assets.
 *
 * @param {Object} gltf A javascript object containing a glTF asset.
 * @param {Object} [options] Object with the following properties:
 * @param {Boolean} [options.secure=false] Prevent the converter from reading separate resources from outside of the <code>resourceDirectory</code>.
 * @param {String} [options.resourceDirectory] The path to look in when reading separate files.
 * @returns {Promise} A promise that resolves to the glTF asset when all resources are read.
 *
 * @private
 */
function readResources(gltf, options) {
    addPipelineExtras(gltf);
    options = defaultValue(options, {});

    var bufferPromises = [];
    var resourcePromises = [];

    ForEach.buffer(gltf, function(buffer) {
        bufferPromises.push(readBuffer(gltf, buffer, options));
    });

    // Buffers need to be read first because images and shader may resolve to bufferViews
    return Promise.all(bufferPromises)
        .then(function() {
            ForEach.shader(gltf, function (shader) {
                resourcePromises.push(readShader(gltf, shader, options));
            });
            ForEach.image(gltf, function (image) {
                resourcePromises.push(readImage(gltf, image, options));
                ForEach.compressedImage(image, function(compressedImage) {
                    resourcePromises.push(readImage(gltf, compressedImage, options));
                });
            });
            return Promise.all(resourcePromises);
        })
        .then(function() {
            return gltf;
        });
}

function readBuffer(gltf, buffer, options) {
    return readResource(gltf, buffer, options)
        .then(function(data) {
            buffer.extras._pipeline.source = data;
        });
}

function readImage(gltf, image, options) {
    return readResource(gltf, image, options)
        .then(function(data) {
            image.extras._pipeline.source = data;
        });
}

function readShader(gltf, shader, options) {
    return readResource(gltf, shader, options)
        .then(function(data) {
            shader.extras._pipeline.source = data.toString();
        });
}

function readResource(gltf, object, options) {
    var uri = object.uri;
    delete object.uri; // Don't hold onto the uri, its contents will be stored in extras._pipeline.source

    // Source already exists if the gltf was converted from a glb
    var source = object.extras._pipeline.source;
    if (defined(source)) {
        return Promise.resolve(Buffer.from(source));
    }
    // Handle reading buffer view from 1.0 glb model
    var extensions = object.extensions;
    if (defined(extensions)) {
        var khrBinaryGltf = extensions.KHR_binary_glTF;
        if (defined(khrBinaryGltf)) {
            return Promise.resolve(readBufferView(gltf, khrBinaryGltf.bufferView));
        }
    }
    if (defined(object.bufferView)) {
        return Promise.resolve(readBufferView(gltf, object.bufferView));
    }
    if (isDataUri(uri)) {
        return Promise.resolve(dataUriToBuffer(uri));
    }
    return readFile(object, uri, options);
}

function readBufferView(gltf, bufferViewId) {
    var bufferView = gltf.bufferViews[bufferViewId];
    var buffer = gltf.buffers[bufferView.buffer];
    var source = buffer.extras._pipeline.source;
    var byteOffset = defaultValue(bufferView.byteOffset, 0);
    return source.slice(byteOffset, byteOffset + bufferView.byteLength);
}

function readFile(object, uri, options) {
    uri = decodeURI(uri);
    var resourceDirectory = options.resourceDirectory;
    var relativePath;
    var absolutePath;

    if (path.isAbsolute(uri)) {
        relativePath = path.basename(uri);
        absolutePath = uri;
    } else {
        if (!defined(resourceDirectory)) {
            return Promise.reject(new RuntimeError('glTF model references separate files but no resourceDirectory is supplied'));
        }
        relativePath = uri;
        absolutePath = path.join(resourceDirectory, uri);
    }

    if (relativePath.indexOf('..') === 0) {
        return Promise.reject(new RuntimeError(uri + ' is outside of the resource directory and the secure flag is true.'));
    }

    if (!defined(object.name)) {
        var extension = path.extname(uri);
        object.name = path.basename(uri, extension);
    }

    object.extras._pipeline.absolutePath = absolutePath;
    object.extras._pipeline.relativePath = relativePath;
    return fsExtra.readFile(absolutePath);
}
