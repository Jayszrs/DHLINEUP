import express from 'express';
import { createApp } from './backend/src/app.js';
const app=createApp({},express());
export default app;
if (!process.env.VERCEL && process.env.NODE_ENV !== 'test') app.listen(Number(process.env.PORT || 8090), '127.0.0.1', () => console.log(`FleetSync JavaScript: http://127.0.0.1:${process.env.PORT || 8090}`));
