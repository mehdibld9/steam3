import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import passwordResetRouter from "./passwordReset";
import accountsRouter from "./accounts";
import commentsRouter from "./comments";
import usersRouter from "./users";
import adLinksRouter from "./adlinks";
import adminRouter from "./admin";
import statsRouter from "./stats";
import giveawaysRouter from "./giveaways";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/auth", passwordResetRouter);
router.use("/accounts", accountsRouter);
router.use("/accounts/:accountId/comments", commentsRouter);
router.use("/users", usersRouter);
router.use("/ad-links", adLinksRouter);
router.use("/admin", adminRouter);
router.use(statsRouter);
router.use("/giveaways", giveawaysRouter);

export default router;
