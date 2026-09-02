import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';
import authRoutes from './routes/auth.routes.js';
import hrRoutes from './routes/hr.routes.js';
import serviceRequestRoutes from './routes/service-requests.routes.js';
import clientRoutes from './routes/client.routes.js';
import financeRoutes from './routes/finance.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import adminRoutes from './routes/admin.routes.js';
import aiRoutes from './routes/ai.routes.js';
import announcementRoutes from './routes/announcement.routes.js';
import recruitmentRoutes from './routes/recruitment.routes.js';
import marketingRoutes from './routes/marketing.routes.js';
import projectsRoutes from './routes/projects.routes.js';
import studioRoutes from './routes/studio.routes.js';
import adminStudioRoutes from './routes/admin-studio.routes.js';
import mobileStudioRoutes from './routes/mobile-studio.routes.js';
import adminMobileStudioRoutes from './routes/admin-mobile-studio.routes.js';
import { initSocket } from './config/socket.js';

dotenv.config();

const app = express();
const server = http.createServer(app);
initSocket(server);
const PORT = Number(process.env.PORT) || 5000;

app.use(cors({
  origin: "http://localhost:5173",
  credentials: true,
}));
app.use(express.json());
app.use(morgan('dev'));

app.use('/api/auth', authRoutes);
app.use('/api/hr', hrRoutes);
app.use('/api/service-requests', serviceRequestRoutes);
app.use('/api/client', clientRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/recruitment', recruitmentRoutes);
app.use('/api/marketing', marketingRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/studio', studioRoutes);
app.use('/api/admin/studio', adminStudioRoutes);
app.use('/api/mobile-studio', mobileStudioRoutes);
app.use('/api/admin/mobile-studio', adminMobileStudioRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'OK', message: 'BusinessOS API is running' });
});


  server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});


export default app;
