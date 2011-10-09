/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */
/*  SHA-1 implementation in JavaScript | (c) Chris Veness 2002-2010 | www.movable-type.co.uk      */
/*   - see http://csrc.nist.gov/groups/ST/toolkit/secure_hashing.html                             */
/*         http://csrc.nist.gov/groups/ST/toolkit/examples.html                                   */
/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */
/*
* Used under creative commons attribution license, per http://www.movable-type.co.uk/scripts/sha1.html 2011-02-04
*/

/*jslint node:true */
//
// function 'f' [§4.1.1]
//
var sha1f, ROTL, toHexStr, exports = module.exports, Utf8;

sha1f = function(s, x, y, z)  {
	var ret = null;
	/*jslint bitwise:false */
	switch (s) {
		case 0: ret = (x & y) ^ (~x & z); break;           // Ch()
		case 1: ret =  x ^ y ^ z; break;                    // Parity()
		case 2: ret = (x & y) ^ (x & z) ^ (y & z); break;  // Maj()
		case 3: ret = x ^ y ^ z; break;                    // Parity()
	}
	/*jslint bitwise:true */
	return(ret);
};
//
// rotate left (circular left shift) value x by n positions [§3.2.5]
//
ROTL = function(x, n) {
	/*jslint bitwise:false */
	var ret = (x<<n) | (x>>>(32-n));
	/*jslint bitwise:true */
	return ret;
};

//
// hexadecimal representation of a number 
//   (note toString(16) is implementation-dependant, and  
//   in IE returns signed numbers when used on full words)
//
toHexStr = function(n) {
	var s="", v, i;
	/*jslint bitwise:false */
	for (i=7; i>=0; i--) { v = (n>>>(i*4)) & 0xf; s += v.toString(16); }
	/*jslint bitwise:true */
	return s;
};

/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */
/*  Utf8 class: encode / decode between multi-byte Unicode characters and UTF-8 multiple          */
/*              single-byte character encoding (c) Chris Veness 2002-2010                         */
/* - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  */


/**
 * Encode multi-byte Unicode string into utf-8 multiple single-byte characters 
 * (BMP / basic multilingual plane only)
 *
 * Chars in range U+0080 - U+07FF are encoded in 2 chars, U+0800 - U+FFFF in 3 chars
 *
 * @param {String} strUni Unicode string to be encoded as UTF-8
 * @returns {String} encoded string
 */
Utf8 = {
	encode : function(strUni) {
	  // use regular expressions & String.replace callback function for better efficiency 
	  // than procedural approaches
	  var strUtf = strUni.replace(
	      /[\u0080-\u07ff]/g,  // U+0080 - U+07FF => 2 bytes 110yyyyy, 10zzzzzz
	      function(c) { 
			/*jslint bitwise:false */
	        var cc = c.charCodeAt(0), r = String.fromCharCode(0xc0 | cc>>6, 0x80 | cc&0x3f); 
			/*jslint bitwise:true */
			return r;
		}
	    );
	  strUtf = strUtf.replace(
	      /[\u0800-\uffff]/g,  // U+0800 - U+FFFF => 3 bytes 1110xxxx, 10yyyyyy, 10zzzzzz
	      function(c) { 
			/*jslint bitwise:false */
	        var cc = c.charCodeAt(0), r = String.fromCharCode(0xe0 | cc>>12, 0x80 | cc>>6&0x3F, 0x80 | cc&0x3f); 
			/*jslint bitwise:true */
			return r;
		}
	    );
	  return strUtf;
	},

/**
 * Decode utf-8 encoded string back into multi-byte Unicode characters
 *
 * @param {String} strUtf UTF-8 string to be decoded back to Unicode
 * @returns {String} decoded string
 */
	decode : function(strUtf) {
	  // note: decode 3-byte chars first as decoded 2-byte strings could appear to be 3-byte char!
	  var strUni = strUtf.replace(
	      /[\u00e0-\u00ef][\u0080-\u00bf][\u0080-\u00bf]/g,  // 3-byte chars
	      function(c) {  // (note parentheses for precence)
			/*jslint bitwise:false */
	        var cc = ((c.charCodeAt(0)&0x0f)<<12) | ((c.charCodeAt(1)&0x3f)<<6) | ( c.charCodeAt(2)&0x3f); 
			/*jslint bitwise:true */
	        return String.fromCharCode(cc); }
	    );
	  strUni = strUni.replace(
	      /[\u00c0-\u00df][\u0080-\u00bf]/g,                 // 2-byte chars
	      function(c) {  // (note parentheses for precence)
			/*jslint bitwise:false */
	        var cc = (c.charCodeAt(0)&0x1f)<<6 | c.charCodeAt(1)&0x3f;
			/*jslint bitwise:true */
	        return String.fromCharCode(cc); }
	    );
	  return strUni;
	}
};

exports.sha1 = {
	/**
	 * Generates SHA-1 hash of string
	 *
	 * @param {String} msg                String to be hashed
	 * @param {Boolean} [utf8encode=true] Encode msg as UTF-8 before generating hash
	 * @returns {String}                  Hash of msg as hex character string
	 */
	hash : function(msg, utf8encode) {
		var i, j, t, K, l, N, M, H0, H1, H2, H3, H4, W, a, b, c, d, e, s, T;
	  
	  utf8encode =  (typeof utf8encode === 'undefined') ? true : utf8encode;

	  // convert string to UTF-8, as SHA only deals with byte-streams
	  if (utf8encode) {msg = Utf8.encode(msg);}

	  // constants [§4.2.1]
	  K = [0x5a827999, 0x6ed9eba1, 0x8f1bbcdc, 0xca62c1d6];

	  // PREPROCESSING 

	  msg += String.fromCharCode(0x80);  // add trailing '1' bit (+ 0's padding) to string [§5.1.1]

	  // convert string msg into 512-bit/16-integer blocks arrays of ints [§5.2.1]
	  l = msg.length/4 + 2;  // length (in 32-bit integers) of msg + '1' + appended length
	  N = Math.ceil(l/16);   // number of 16-integer-blocks required to hold 'l' ints
	  M = new Array(N);

	  for (i=0; i<N; i++) {
	    M[i] = new Array(16);
	    for (j=0; j<16; j++) {  // encode 4 chars per integer, big-endian encoding
			/*jslint bitwise:false */
	      M[i][j] = (msg.charCodeAt(i*64+j*4)<<24) | (msg.charCodeAt(i*64+j*4+1)<<16) | 
	        (msg.charCodeAt(i*64+j*4+2)<<8) | (msg.charCodeAt(i*64+j*4+3));
			/*jslint bitwise:true */
	    } // note running off the end of msg is ok 'cos bitwise ops on NaN return 0
	  }
	  // add length (in bits) into final pair of 32-bit integers (big-endian) [§5.1.1]
	  // note: most significant word would be (len-1)*8 >>> 32, but since JS converts
	  // bitwise-op args to 32 bits, we need to simulate this by arithmetic operators
	M[N-1][14] = ((msg.length-1)*8) / Math.pow(2, 32); 
	M[N-1][14] = Math.floor(M[N-1][14]);
	/*jslint bitwise:false */
	M[N-1][15] = ((msg.length-1)*8) & 0xffffffff;
	/*jslint bitwise:true */

	  // set initial hash value [§5.3.1]
	  H0 = 0x67452301;
	  H1 = 0xefcdab89;
	  H2 = 0x98badcfe;
	  H3 = 0x10325476;
	  H4 = 0xc3d2e1f0;

	  // HASH COMPUTATION [§6.1.2]

	  W = new Array(80);
	  for (i=0; i<N; i++) {

	    // 1 - prepare message schedule 'W'
	    for ( t=0;  t<16; t++) {W[t] = M[i][t];}
		/*jslint bitwise:false */
	    for ( t=16; t<80; t++) {W[t] = ROTL(W[t-3] ^ W[t-8] ^ W[t-14] ^ W[t-16], 1);}
		/*jslint bitwise:true */

	    // 2 - initialise five working variables a, b, c, d, e with previous hash value
	    a = H0; b = H1; c = H2; d = H3; e = H4;

	    // 3 - main loop
	    for ( t=0; t<80; t++) {
	      s = Math.floor(t/20); // seq for blocks of 'f' functions and 'K' constants
			/*jslint bitwise:false */
	      T = (ROTL(a,5) + sha1f(s,b,c,d) + e + K[s] + W[t]) & 0xffffffff;
			/*jslint bitwise:true */
	      e = d;
	      d = c;
	      c = ROTL(b, 30);
	      b = a;
	      a = T;
	    }

	    // 4 - compute the new intermediate hash value
		/*jslint bitwise:false */
	    H0 = (H0+a) & 0xffffffff;  // note 'addition modulo 2^32'
	    H1 = (H1+b) & 0xffffffff; 
	    H2 = (H2+c) & 0xffffffff; 
	    H3 = (H3+d) & 0xffffffff; 
	    H4 = (H4+e) & 0xffffffff;
		/*jslint bitwise:true */
	  }

	  return toHexStr(H0) + toHexStr(H1) + 
	    toHexStr(H2) + toHexStr(H3) + toHexStr(H4);
	}



};
