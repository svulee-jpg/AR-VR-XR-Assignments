"""Build the realism assets from CC0 Poly Haven HDRIs (see ASSETS.md).
  python3 tools/make_realism_assets.py <folder with the .hdr files> img
Needs Python 3 with numpy and Pillow.
Writes env/apartment-512.hdr (flat RGBE, for image-based lighting) and views/<view>-<light>.jpg
(window views: a rectilinear "photo" cut out of each panorama)."""
import sys, os, numpy as np
from PIL import Image, ImageFilter

def read_hdr(path):
    data = open(path, 'rb').read()
    i = 0
    while True:
        j = data.index(b'\n', i); line = data[i:j]; i = j + 1
        if line.startswith(b'-Y') or line.startswith(b'+Y'):
            parts = line.split(); H = int(parts[1]); W = int(parts[3]); break
    out = np.zeros((H, W, 4), np.uint8)
    for y in range(H):
        if data[i] == 2 and data[i+1] == 2:
            i += 4
            for c in range(4):
                x = 0
                while x < W:
                    n = data[i]; i += 1
                    if n > 128:
                        n -= 128; out[y, x:x+n, c] = data[i]; i += 1
                    else:
                        out[y, x:x+n, c] = np.frombuffer(data[i:i+n], np.uint8); i += n
                    x += n
        else:
            out[y] = np.frombuffer(data[i:i+W*4], np.uint8).reshape(W, 4); i += W*4
    e = out[..., 3].astype(np.float32)
    scale = np.where(e > 0, np.ldexp(1.0, (e - 136).astype(np.int32)), 0)
    return out[..., :3].astype(np.float32) * scale[..., None]

def tonemap(rgb, exposure=1.0):
    x = rgb * exposure
    # ACES-like filmic curve (Narkowicz), then sRGB gamma
    a, b, c, d, e = 2.51, 0.03, 2.43, 0.59, 0.14
    y = np.clip((x*(a*x+b))/(x*(c*x+d)+e), 0, 1)
    return (np.where(y <= 0.0031308, 12.92*y, 1.055*np.power(y, 1/2.4) - 0.055) * 255).astype(np.uint8)


def write_hdr_flat(path, rgb):
    H, W, _ = rgb.shape
    m = rgb.max(axis=2)
    e = np.zeros((H, W), np.int32); mant = np.zeros((H, W), np.float64)
    nz = m > 1e-32
    mant[nz], e[nz] = np.frexp(m[nz])
    out = np.zeros((H, W, 4), np.uint8)
    sc = np.where(nz, mant * 256.0 / np.where(nz, m, 1), 0)
    out[..., :3] = np.clip(rgb * sc[..., None], 0, 255).astype(np.uint8)
    out[..., 3] = np.where(nz, e + 128, 0).astype(np.uint8)
    with open(path, 'wb') as f:
        f.write(b'#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y %d +X %d\n' % (H, W))
        f.write(out.tobytes())

def downsample(rgb, f):
    H, W, _ = rgb.shape
    return rgb[:H//f*f, :W//f*f].reshape(H//f, f, W//f, f, 3).mean(axis=(1, 3))

def bilinear(img, u, v):
    H, W, _ = img.shape
    x = (u % 1.0) * W - 0.5; y = np.clip(v * H - 0.5, 0, H - 1)
    x0 = np.floor(x).astype(int); y0 = np.floor(y).astype(int)
    fx = (x - x0)[..., None]; fy = (y - y0)[..., None]
    x0m = x0 % W; x1 = (x0 + 1) % W; y1 = np.clip(y0 + 1, 0, H - 1)
    return (img[y0, x0m]*(1-fx)*(1-fy) + img[y0, x1]*fx*(1-fy) + img[y1, x0m]*(1-fx)*fy + img[y1, x1]*fx*fy)

def view(rgb, yaw_u, pitch_deg, hfov_deg, W, H):
    """Rectilinear view. yaw_u = centre as a fraction of the panorama width."""
    t = np.tan(np.radians(hfov_deg) / 2)
    xs = (np.arange(W) + 0.5) / W * 2 - 1
    ys = 1 - (np.arange(H) + 0.5) / H * 2
    X, Y = np.meshgrid(xs * t, ys * t * H / W)
    Z = np.ones_like(X)
    p = np.radians(pitch_deg)
    Y2 = Y * np.cos(p) + Z * np.sin(p); Z2 = -Y * np.sin(p) + Z * np.cos(p)
    lon = np.arctan2(X, Z2); lat = np.arctan2(Y2, np.hypot(X, Z2))
    u = yaw_u + lon / (2 * np.pi); v = 0.5 - lat / np.pi
    return bilinear(rgb, u, v)

def grade_evening(img8, warm_sun=False):
    a = img8.astype(np.float32) / 255
    lum = a.mean(axis=2, keepdims=True)
    blue = np.array([0.55, 0.62, 0.95]) * (0.35 * a + 0.15 * lum)
    if warm_sun:
        blue = 0.55 * a + 0.05
    return (np.clip(blue, 0, 1) * 255).astype(np.uint8)

if __name__ == '__main__':
    src, out = sys.argv[1], sys.argv[2]
    os.makedirs(out + '/env', exist_ok=True); os.makedirs(out + '/views', exist_ok=True)
    env = downsample(read_hdr(src + '/lebombo_1k.hdr'), 2)
    # Keep only a little of the panorama's colour: its wooden floor would tint every white wall beige,
    # and a finish configurator must show colours faithfully.
    lum = (env * np.array([0.2126, 0.7152, 0.0722])).sum(axis=2, keepdims=True)
    env = lum * 0.8 + env * 0.2
    write_hdr_flat(out + '/env/apartment-512.hdr', env)
    SPEC = {  # view: (file, centre, pitch, hfov, exposure)
        'city':   ('potsdamer_platz_1k.hdr', 0.64, 17, 76, 1.25),
        'sea':    ('venice_sunset_1k.hdr',   0.50, 7, 76, 0.95),
        'garden': ('rooitou_park_1k.hdr',    0.32, 14, 76, 1.3),
    }
    W, H = 640, 768   # same shape as the glass (1.3 m x 1.52 m)
    for name, (f, cu, pitch, fov, ex) in SPEC.items():
        rgb = read_hdr(src + '/' + f)
        v = view(rgb, cu, pitch, fov, W, H)
        day = tonemap(v, ex)
        im = Image.fromarray(day).filter(ImageFilter.UnsharpMask(radius=2, percent=60, threshold=2))
        im.save(f'{out}/views/{name}-day.jpg', quality=84)
        eve = tonemap(v, ex * (0.6 if name == 'sea' else 0.45))
        Image.fromarray(grade_evening(eve, warm_sun=(name == 'sea'))).save(f'{out}/views/{name}-evening.jpg', quality=84)
    print('ok')
