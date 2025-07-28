// Parity of a single half-byte
function parity4(b) {
	b = b ^ (b >>> 1);
	b = b ^ (b >>> 2);
	b = b ^ (b >>> 4);
	b = b ^ (b >>> 8);
	b = b ^ (b >>> 16);
	return b & 1;
}
// Parity of a byte
function parity8(b) {
	return parity4(b & 0b1111) ^ parity4(b >> 4);
}
// Encode single half-byte
function hamming_encode_single(b) {
	var p1 = parity4(b & 0b1101);
	var p2 = parity4(b & 0b1011);
	var p3 = parity4(b & 0b0111);	
	var o47 = (p1 << 6) | (p2 << 5) | ((b & 0b1000) << 1) | (p3 << 3) | (b & 0b0111);
	var p4 = parity8(o47);
	return (o47 << 1) | p4;
}
// Pre-compute the hamming-key for fast encoding
var hammEncodeKey = []
for(var i = 0; i < 16; i++) {
	hammEncodeKey[i] = hamming_encode_single(i);
}
function hamming48_encode(array, use_manchester) {
	if (use_manchester) {use_manchester = 0b10101010;}
	else {use_manchester = 0;}
	input = Uint8Array.from(array);
	output = new Array();
	
	var i = 0;
	var a, b;
	while(i < input.length) {
		output.push(hammEncodeKey[input[i] & 0b1111] ^ use_manchester);
		output.push(hammEncodeKey[input[i] >> 4] ^ use_manchester);
		i++;
	}
	
	return output;
};

// Decode single byte to half-byte and status
function hamming48_decode_single(b) {
	var z1 = parity8(b & 0b10101010);
	var z2 = parity8(b & 0b01100110);
	var z3 = parity8(b & 0b00011110);
	var err47 = (z1 | (z2 << 1) | (z3 << 2));
	var perr = parity8(b >>> 1) != (b & 0b1);

	var stat = 0; // 0 = no error, 1 = corrected, 2 = can't correct
	
	if (!perr) {
		if (err47 == 0) {
			stat = 0; 
		} else {
			stat = 2;
		}
	} else {
		stat = 1; // If err == 0, it indicates a parity p4 bit error, don't correct
		if (err47 != 0) {
			b = b ^ (0b1 << (8 - err47));
		}
	}
	
	b = b >>> 1;
	return [(b & 0b111) | ((b >> 1) & 0b1000), stat];
}
function hamming48_decode(array, use_manchester) {
	output = []
	errors = []
	if (use_manchester) {use_manchester = 0b10101010;}
	else {use_manchester = 0;}
	
	var i = 0;
	while (i < array.length) {
		var a = hamming48_decode_single(array[i++] ^ use_manchester);
		var b = hamming48_decode_single(array[i++] ^ use_manchester);
		output.push((a[0]) | (b[0] << 4));
		if (a[1] == 0 && b[1] == 0) {errors.push(0);}
		else if (a[1] == 2 || b[1] == 2) {errors.push(2);}
		else {errors.push(1);}
	}
	
	return {bytes: output, errors: errors};
}

// According to https://cgjennings.ca/articles/jpeg-compression/
// From lowest division to highest excluding DC
steganoCoeffs = [[0, 2], [0, 1], [1, 0], [1, 1], [2, 1], [2, 0], [1, 2], [3, 0],
				 [2, 2], [0, 3], [3, 1], [4, 0], [1, 3], [4, 1], [3, 2], [0, 4],
				 [5, 0], [1, 4], [3, 3], [5, 1], [4, 2], [2, 4], [0, 5], [6, 0],
				 [0, 6], [3, 4], [5, 2], [4, 3], [2, 5], [1, 5], [1, 6], [6, 1]];

const dctSize = 16; // kernelSize
imgDCTbasis0 = new Image();
//imgDCTbasis0.src = "img/dct0.png";
imgDCTbasis1 = new Image();
//imgDCTbasis1.src = "img/dct1.png";

// We use DCT coefficients in 8x8 block for steganography
function bytesToSingleDCT(inctx, dx, dy, bytes) {
	var bytes = Array.from(bytes);
	if (!imgDCTbasis0.complete || !imgDCTbasis1.complete) {return false;}
	if (!bytes.length) {
		if (isNaN(bytes)) {return false;}
		bytes = [bytes, bytes];
	} else if (bytes.length == 1) {
		bytes = [bytes[0], bytes[0]];
	} else if (bytes.length == 2) {
		bytes = [bytes[0], bytes[1]];
	} else {
		return false;
	}
	
	var norm = 0;
	bytes.forEach((b) => {
		for(var bit = 0; bit < 8; bit++) {
			if (b & (1 << bit)) {norm++;}
		}
	});
	
	inctx.globalCompositeOperation = "lighter";
	inctx.globalAlpha = 1;
	bytes.forEach((b, bi) => {
		for(var bit = 0; bit < 8; bit++) {
			st = steganoCoeffs[bi * 8 + bit];
			inctx.drawImage((b & (1 << (7-bit))) ? imgDCTbasis0 : imgDCTbasis1, st[0] * dctSize, st[1] * dctSize, dctSize, dctSize, dx, dy, dctSize, dctSize);
		}
	});
	
	inctx.globalAlpha = 1;
	inctx.globalCompositeOperation = "source-over";
}

// Constant! So that there won't be visible "noise" each update
// And so that we can check later if these numbers are correct, maybe.
// Fills the array (up to 255 bytes) to the length nBytes
steganoRndNumbers = [221,194,162,117,216,143,126,244,95,77,129,158,95,32,153,39,190,16,79,113,99,140,2,116,65,143,225,87,165,248,166,227,215,52,245,114,197,87,100,49,64,132,138,220,222,66,220,235,227,131,11,201,97,33,23,36,129,10,132,60,11,32,39,239,68,253,251,60,83,105,51,32,91,163,199,160,81,133,243,249,26,42,36,81,191,45,243,173,6,61,90,33,73,102,60,15,6,74,83,108,187,236,70,167,100,158,93,195,238,146,220,57,105,176,231,189,27,88,91,138,159,110,106,52,231,240,147,220,201,17,137,2,65,162,81,182,144,85,160,225,135,109,29,208,146,105,62,33,18,221,19,10,191,236,158,169,228,96,46,187,25,34,85,97,138,134,186,13,88,203,41,239,46,215,207,9,139,90,84,189,31,80,17,247,74,9,115,52,41,224,213,142,113,112,166,36,79,149,58,96,51,13,51,64,28,230,3,11,63,136,139,70,106,130,119,100,126,181,150,30,85,104,44,161,78,227,226,242,68,4,6,179,229,211,239,159,119,47,0,196,26,95,47,150,121,199,169,133,51,243,224,222,103,102,248];
function steganoFillRandom(array, nbytes) {
	if (array.length >= nbytes) {return array;}
	return array.concat(steganoRndNumbers.slice(array.length, nbytes));
}

//w, h in dctSize x dctSize blocks! Use hamming48 before!
// bytesToDCT(canvas ctx, start x, start y, width in blocks, height in blocks, data)
function bytesToDCT(inctx, dx, dy, w, h, bytes) {
	inctx.globalCompositeOperation = "source-over";
	inctx.globalAlpha = 1;
	inctx.fillStyle="black";
	inctx.fillRect(0, 0, w*dctSize, h*dctSize);
	var bytes = Array.from(bytes);
	if (bytes.length > w*h*2) {bytes = bytes.slice(0, w*h*2);}
	//else if (bytes.length < w*h*2) {bytes = bytes.concat(steganoRndNumbers.slice(0, w*h*2-bytes.length));}
	
	var bid = 0;
	for (var i = 0; i < w; i++) {
		for (var j = 0; j < h; j++) {
			bytesToSingleDCT(inctx, dx + dctSize*i, dy + dctSize*j, [bytes[bid], bytes[bid+1]]);
			bid += 2;
		}
	}
}
