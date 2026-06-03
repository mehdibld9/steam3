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
import reportsRouter from "./reports";
import messagesRouter from "./messages";

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
router.use("/reports", reportsRouter);
router.use("/messages", messagesRouter);

export default router;
