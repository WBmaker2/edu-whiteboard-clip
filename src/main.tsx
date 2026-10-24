import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ShareViewer } from "./components/ShareViewer";
import { QuizViewer } from "./components/QuizViewer";
import { readQuizData, readShareData } from "./lib/share";
import { loadEnglishDictionary } from "./lib/i18n";
import { useStudioStore } from "./store/studioStore";
import "./styles.css";

const isQuizView = readQuizData(window.location.hash) !== null;
const isShareView = readShareData(window.location.hash) !== null;

async function bootstrap() {
  if (useStudioStore.getState().language === "en") {
    await loadEnglishDictionary();
  }
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ErrorBoundary>
        {isQuizView ? <QuizViewer /> : isShareView ? <ShareViewer /> : <App />}
      </ErrorBoundary>
    </StrictMode>,
  );
}

void bootstrap();
