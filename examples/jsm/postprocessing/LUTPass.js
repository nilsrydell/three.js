import { ShaderPass } from './ShaderPass.js';

const LUTShader = function(isWebGL2) {

	return {

		defines: {
			USE_3DTEXTURE: isWebGL2
		},

		uniforms: {
			lut3d: { value: null },

			lut: { value: null },
			lutSize: { value: 0 },

			tDiffuse: { value: null },
			intensity: { value: 1.0 },
		},

		vertexShader: /* glsl */`

			varying vec2 vUv;

			void main() {

				vUv = uv;
				gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

			}

		`,


		get fragmentShader() {
			let shader = '';
			shader += this.defines.USE_3DTEXTURE ? `
			precision highp sampler3D;
			` : `
			`;
			shader += `
			uniform float lutSize;
			`;
			shader += this.defines.USE_3DTEXTURE ? `
			uniform sampler3D lut3d;
			` : `
			uniform sampler2D lut;

			vec3 lutLookup( sampler2D tex, float size, vec3 rgb ) {

				float sliceHeight = 1.0 / size;
				float yPixelHeight = 1.0 / ( size * size );

				// Get the slices on either side of the sample
				float slice = rgb.b * size;
				float interp = fract( slice );
				float slice0 = slice - interp;
				float centeredInterp = interp - 0.5;

				float slice1 = slice0 + sign( centeredInterp );

				// Pull y sample in by half a pixel in each direction to avoid color
				// bleeding from adjacent slices.
				float greenOffset = clamp( rgb.g * sliceHeight, yPixelHeight * 0.5, sliceHeight - yPixelHeight * 0.5 );

				vec2 uv0 = vec2(
					rgb.r,
					slice0 * sliceHeight + greenOffset
				);
				vec2 uv1 = vec2(
					rgb.r,
					slice1 * sliceHeight + greenOffset
				);

				vec3 sample0 = texture2D( tex, uv0 ).rgb;
				vec3 sample1 = texture2D( tex, uv1 ).rgb;

				return mix( sample0, sample1, abs( centeredInterp ) );

			}
			`;
			shader += `
			varying vec2 vUv;
			uniform float intensity;
			uniform sampler2D tDiffuse;
			void main() {

				vec4 val = texture2D( tDiffuse, vUv );
				vec4 lutVal;

				// pull the sample in by half a pixel so the sample begins
				// at the center of the edge pixels.
				float pixelWidth = 1.0 / lutSize;
				float halfPixelWidth = 0.5 / lutSize;
				vec3 uvw = vec3( halfPixelWidth ) + val.rgb * ( 1.0 - pixelWidth );
			`;
			shader += this.defines.USE_3DTEXTURE ? `
				lutVal = vec4( texture( lut3d, uvw ).rgb, val.a );
			` : `
				lutVal = vec4( lutLookup( lut, lutSize, uvw ), val.a );
			`;
			shader += `
				gl_FragColor = vec4( mix( val, lutVal, intensity ) );

			}`
			return shader;
		},
	}
};

class LUTPass extends ShaderPass {

	set lut( v ) {

		const material = this.material;
		if ( v !== this.lut ) {

			material.uniforms.lut3d.value = null;
			material.uniforms.lut.value = null;

			if ( v ) {

				const is3dTextureDefine = v.isDataTexture3D ? true : false;
				if ( is3dTextureDefine !== material.defines.USE_3DTEXTURE ) {

					material.defines.USE_3DTEXTURE = is3dTextureDefine;
					material.fragmentShader = LUTShader(is3dTextureDefine).fragmentShader;
					material.needsUpdate = true;

				}

				material.uniforms.lutSize.value = v.image.width;
				if ( v.isDataTexture3D ) {

					material.uniforms.lut3d.value = v;

				} else {

					material.uniforms.lut.value = v;

				}

			}

		}

	}

	get lut() {

		return this.material.uniforms.lut.value || this.material.uniforms.lut3d.value;

	}

	set intensity( v ) {

		this.material.uniforms.intensity.value = v;

	}

	get intensity() {

		return this.material.uniforms.intensity.value;

	}

	constructor( options = {} ) {
		super(LUTShader(true));
		this.lut = options.lut || null;
		this.intensity = 'intensity' in options ? options.intensity : 1;

	}

}

export { LUTPass };
