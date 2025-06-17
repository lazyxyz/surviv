import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
import crateRoutes from './routes/crateRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use((req: Request, res: Response, next: NextFunction): void => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  next();
});

app.use('/api', authRoutes);
app.use('/api', crateRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});