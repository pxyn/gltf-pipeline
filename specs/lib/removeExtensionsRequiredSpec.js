'use strict';
var removeExtensionsRequired = require('../../lib/removeExtensionsRequired');

describe('removeExtensionsRequired', function() {
    it('removes extension from extensionsRequired', function() {
        var gltf = {
            extensionsRequired: [
                'extension1',
                'extension2'
            ],
            extensionsUsed: [
                'extension1',
                'extension2'
            ]
        };
        removeExtensionsRequired(gltf, 'extension1');
        expect(gltf.extensionsRequired).toEqual(['extension2']);
        removeExtensionsRequired(gltf, 'extension2');
        expect(gltf.extensionsRequired).toBeUndefined();
        expect(gltf.extensionsUsed).toEqual(['extension1', 'extension2']);

        var emptyGltf = {};
        removeExtensionsRequired(gltf, 'extension1');
        expect(emptyGltf).toEqual({});
    });
});
