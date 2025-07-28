import numpy as np
from scipy.fftpack import dct
from PIL import Image

# Size of kernel block in pixels
kernelSize=16
# Number of bytes in a single kernel block
bytesPerKernel=2
# Use Manchester encoding?
useManchester = True

# Size of steganography block in kernelSize*kernelSize squares
w = 6
h = 1

# Position of the steganography block
startX = 16*30
startY = 16*80

# See stegano.js: DCT coefficients order in which data is stored
# https://cgjennings.ca/articles/jpeg-compression/
# See step 4, quantization, the less the number, the better it is to store a bit in that coefficient
steganoCoeffs = [[0, 2], [0, 1], [1, 0], [1, 1], [2, 1], [2, 0], [1, 2], [3, 0], [2, 2], [0, 3], [3, 1], [4, 0], [1, 3], [4, 1], [3, 2], [0, 4], [5, 0], [1, 4], [3, 3], [5, 1], [4, 2], [2, 4], [0, 5], [6, 0], [0, 6], [3, 4], [5, 2], [4, 3], [2, 5], [1, 5], [1, 6], [6, 1]]

def dct2(block):
    return dct(dct(block.T).T)

def kernelToBytes(arr):
    res = dct2(arr[0:kernelSize, 0:kernelSize])
    br = [res[steganoCoeffs[i][1], steganoCoeffs[i][0]] for i in range(bytesPerKernel * 8)]
    bits = [1 if br[i] > 0 else 0 for i in range(bytesPerKernel * 8)]
    data = np.uint8(np.zeros(bytesPerKernel))

    for b in range(bytesPerKernel):
        for i in range(8):
            data[b] |= bits[i+b*8] << (7-i)

    return data

def hamming48_decodebyte(byte, useManchester=False):
    if useManchester:
        byte = byte ^ 0b10101010
    z1 = (byte & 0b10101010).bit_count() % 2
    z2 = (byte & 0b01100110).bit_count() % 2
    z3 = (byte & 0b00011110).bit_count() % 2
    err47 = (z1 | (z2 << 1) | (z3 << 2))
    parity = (byte >> 1).bit_count() % 2

    stat = 0  # 0: No error, 1: Corrected, 2: Can't correct

    if parity == (byte & 0b1):
        if err47 == 0:
            stat = 0
        else:
            stat = 2
    else:
        # Don't correct if err47 == 0 (parity bit error)
        stat = 1
        if err47 != 0:
            byte = byte ^ (0b1 << (8 - err47))

    byte = byte >> 1
    return (byte & 0b111) | ((byte >> 1) & 0b1000), stat


img = np.asarray(Image.open("encoded-test.png").convert('L')) # Or try .jpg!
img = img[startY:startY+kernelSize*h, startX:startX+kernelSize*w]

decodedData = np.array([], dtype=np.uint8)
for x in range(w):
    for y in range(h):
        decodedData = np.append(decodedData, kernelToBytes(img[y*kernelSize:(y+1)*kernelSize, x*kernelSize:(x+1)*kernelSize]))

decodedData = decodedData.flatten()
print("Raw data: ", decodedData.astype(int))

decodedHammingHalfBytes = [hamming48_decodebyte(x, useManchester) for x in decodedData]
finalDecoded = []
finalErrors = 0

for i in range(0, len(decodedHammingHalfBytes), 2):
    a, err1 = decodedHammingHalfBytes[i]
    b, err2 = decodedHammingHalfBytes[i+1]
    finalDecoded.append(int(a | (b << 4)))
    finalErrors += err1+err2

print("Hamming decoded: ", finalDecoded)
print("Errors: ", finalErrors)
