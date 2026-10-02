import server from './server_bundle.cjs';

const app = server.default || server.app || server;

export default app;
