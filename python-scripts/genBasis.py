import numpy as np
from scipy.fftpack import idct
from PIL import Image

# Size of the kernel, in pixels. JPEG uses 8x8px kernel, so use multiples of 8
# For 16x16px kernel usually just two bytes work stably after heavy JPEG compression, maybe 3-4 sometimes
# For 8x8px kernel only one byte per kernel works after JPEG compression, and rescaling/reposition lead to problems
kernelSize=16

# If you plan to use 2 bytes = 16 bits, brightness = 256 / 16 bits = 16
# If you plan to use just 1 byte, brightness = 256 / 8 = 32'
# This is bad (due to lost precision)
# But I haven't found a proper way to use alpha in JS Canvas in straight-adder blending mode
brightness = 15

def idct2(block):
    block = idct(idct(block.T).T)
    minval = np.min(block)
    maxval = np.max(block)
    if (maxval == minval):
        return np.ones(block.shape)
    return (np.asarray(block) - minval) / (maxval - minval)

basis=np.zeros((kernelSize*kernelSize, kernelSize*kernelSize))
antiBasis = np.zeros((kernelSize*kernelSize, kernelSize*kernelSize))

for x in range(kernelSize):
    for y in range(kernelSize):
        coeffs = np.zeros((kernelSize, kernelSize))
        coeffs[x, y] = 1
        basis[x*kernelSize:(x+1)*kernelSize, y*kernelSize:(y+1)*kernelSize] = idct2(coeffs)*brightness
        coeffs[x, y] = -1
        antiBasis[x*kernelSize:(x+1)*kernelSize, y*kernelSize:(y+1)*kernelSize] = idct2(coeffs)*brightness

imageBasis = Image.fromarray(np.uint8(basis), "L")
imageBasis.save("dct0.png")
imageAntiBasis = Image.fromarray(np.uint8(antiBasis), "L")
imageAntiBasis.save("dct1.png")