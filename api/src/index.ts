import express from 'express';
import { env } from '@/config/env';
import { errorMiddleware, notFoundMiddleware } from '@/middlewares';

const app = express();
app.use(express.json());

app.use(notFoundMiddleware);
app.use(errorMiddleware);

app.listen(env.PORT, () => console.log(`listening on ${env.PORT}`));
