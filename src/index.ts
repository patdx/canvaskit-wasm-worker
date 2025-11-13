import CanvasKitInit, { type CanvasKit, type Typeface } from 'canvaskit-wasm';
import canvasKitWasm from 'canvaskit-wasm/bin/canvaskit.wasm';

let canvasKitPromise: Promise<CanvasKit> | null = null;
let robotoTypefacePromise: Promise<Typeface | null> | null = null;

export default {
	async fetch(request, env): Promise<Response> {
		if (new URL(request.url).pathname !== '/') {
			return new Response('Not found', { status: 404 });
		}

		if (canvasKitPromise) {
			console.log('canvaskit already initialized');
		} else {
			console.log('initializing canvaskit');
			// must set __dirname to anything (even undefined or '/') to avoid `__dirname is not defined` error
			(globalThis as any).__dirname = undefined;
			canvasKitPromise = CanvasKitInit({
				instantiateWasm(info: any, receive: any) {
					let instance = new WebAssembly.Instance(canvasKitWasm, info);
					receive(instance);
					return instance.exports;
				},
			} as any);
		}

		const CanvasKit = await canvasKitPromise;

		// Cache the font typeface
		if (!robotoTypefacePromise) {
			console.log('initializing roboto font');
			const assetUrl = new URL('/roboto-latin-500-normal.woff', request.url);
			robotoTypefacePromise = env.ASSETS.fetch(assetUrl)
				.then((response) => response.arrayBuffer())
				.then((fontData) => CanvasKit.Typeface.MakeTypefaceFromData(fontData));
		} else {
			console.log('roboto font already initialized');
		}

		const roboto = await robotoTypefacePromise;
		if (!roboto) {
			throw new Error('Failed to create roboto typeface');
		}

		const pngBytes = await fancyAPI(CanvasKit, roboto);

		return new Response(pngBytes, {
			headers: { 'Content-Type': 'image/png' },
		});
	},
} satisfies ExportedHandler<Env>;

async function fancyAPI(CanvasKit: CanvasKit, roboto: Typeface) {
	let surface = CanvasKit.MakeSurface(300, 300);

	if (!surface) {
		throw new Error('Failed to create surface');
	}

	const canvas = surface.getCanvas();

	const paint = new CanvasKit.Paint();

	const textPaint = new CanvasKit.Paint();
	textPaint.setColor(CanvasKit.Color(40, 0, 0));
	textPaint.setAntiAlias(true);

	const textFont = new CanvasKit.Font(roboto, 30);

	const skpath = starPath(CanvasKit);
	const dpe = CanvasKit.PathEffect.MakeDash([15, 5, 5, 10], 1);

	paint.setPathEffect(dpe);
	paint.setStyle(CanvasKit.PaintStyle.Stroke);
	paint.setStrokeWidth(5.0);
	paint.setAntiAlias(true);
	paint.setColor(CanvasKit.Color(66, 129, 164, 1.0));

	canvas.clear(CanvasKit.Color(255, 255, 255, 1.0));

	canvas.drawPath(skpath, paint);
	canvas.drawText('Try Clicking!', 10, 280, textPaint, textFont);

	surface.flush();

	const img = surface.makeImageSnapshot();
	if (!img) {
		console.error('no snapshot');
		return;
	}
	const pngBytes = img.encodeToBytes();
	if (!pngBytes) {
		console.error('encoding failure');
		return;
	}

	// These delete calls free up memeory in the C++ WASM memory block.
	dpe.delete();
	skpath.delete();
	textPaint.delete();
	paint.delete();
	// roboto is cached and reused, so don't delete it
	textFont.delete();

	surface.dispose();

	return pngBytes;
}

function starPath(CanvasKit: CanvasKit, X = 128, Y = 128, R = 116) {
	let p = new CanvasKit.Path();
	p.moveTo(X + R, Y);
	for (let i = 1; i < 8; i++) {
		let a = 2.6927937 * i;
		p.lineTo(X + R * Math.cos(a), Y + R * Math.sin(a));
	}
	return p;
}
