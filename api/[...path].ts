import { request as httpRequest, type IncomingMessage, type ServerResponse } from 'node:http';
import { request as httpsRequest } from 'node:https';

export const config = { api: { bodyParser: false } };

export default function handler(req: IncomingMessage, res: ServerResponse) {
	const backendUrl = process.env.BACKEND_URL?.trim();
	if (!backendUrl) {
		res.statusCode = 503;
		res.setHeader('Content-Type', 'application/json; charset=utf-8');
		res.end(JSON.stringify({
			status: 'error',
			code: 'BACKEND_NOT_CONFIGURED',
			error: 'The UrbanNex backend URL is not configured.',
		}));
		return;
	}

	let target: URL;
	try {
		target = new URL(req.url || '/', backendUrl);
	} catch {
		res.statusCode = 500;
		res.setHeader('Content-Type', 'application/json; charset=utf-8');
		res.end(JSON.stringify({ status: 'error', code: 'INVALID_BACKEND_URL' }));
		return;
	}

	if (target.protocol !== 'http:' && target.protocol !== 'https:') {
		res.statusCode = 500;
		res.setHeader('Content-Type', 'application/json; charset=utf-8');
		res.end(JSON.stringify({ status: 'error', code: 'INVALID_BACKEND_URL' }));
		return;
	}

	const headers = { ...req.headers, host: target.host };
	delete headers.connection;
	const request = target.protocol === 'https:' ? httpsRequest : httpRequest;
	const upstream = request(target, { method: req.method, headers }, (upstreamResponse) => {
		res.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
		upstreamResponse.pipe(res);
	});

	upstream.on('error', (error) => {
		console.error('[Vercel API proxy] Backend request failed:', error);
		if (!res.headersSent) {
			res.statusCode = 502;
			res.setHeader('Content-Type', 'application/json; charset=utf-8');
			res.end(JSON.stringify({ status: 'error', code: 'BACKEND_UNAVAILABLE' }));
		} else {
			res.destroy(error);
		}
	});

	req.pipe(upstream);
}
