
require("../polyfill");

import { GoogleOAuthProvider } from '@react-oauth/google';
import dynamic from "next/dynamic";
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from "react";
import {
  useAccount,
  useBalance,
  useDisconnect
} from "wagmi";
import { Path, SlotID } from "../constant";
import BotIcon from "../icons/bot.svg";
import LoadingIcon from "../icons/three-dots.svg";
import { getISOLang, getLang } from "../locales";
import { getCSSVar, useMobileScreen } from "../utils";
import { ErrorBoundary } from "./error";
import styles from "./home.module.scss";

import {
  Route,
  HashRouter as Router,
  Routes,
  useLocation,
} from "react-router-dom";
import { api } from "../client/api";
import { getClientConfig } from "../config/client";
import { useAccessStore } from "../store";
import { useAppConfig } from "../store/config";
import { AuthPage } from "./auth";
import { SideBar } from "./sidebar";

export function Loading(props: { noLogo?: boolean }) {
  return (
    <div className={styles["loading-content"] + " no-dark"}>
      {!props.noLogo && <BotIcon />}
      <LoadingIcon />
    </div>
  );
}

const Settings = dynamic(async () => (await import("./settings")).Settings, {
  loading: () => <Loading noLogo />,
});

const Chat = dynamic(async () => (await import("./chat")).Chat, {
  loading: () => <Loading noLogo />,
});

const NewChat = dynamic(async () => (await import("./new-chat")).NewChat, {
  loading: () => <Loading noLogo />,
});

const MaskPage = dynamic(async () => (await import("./mask")).MaskPage, {
  loading: () => <Loading noLogo />,
});

export function useSwitchTheme() {
  const config = useAppConfig();

  useEffect(() => {
    document.body.classList.remove("light");
    document.body.classList.remove("dark");

    if (config.theme === "dark") {
      document.body.classList.add("dark");
    } else if (config.theme === "light") {
      document.body.classList.add("light");
    }

    const metaDescriptionDark = document.querySelector(
      'meta[name="theme-color"][media*="dark"]',
    );
    const metaDescriptionLight = document.querySelector(
      'meta[name="theme-color"][media*="light"]',
    );

    if (config.theme === "auto") {
      metaDescriptionDark?.setAttribute("content", "#151515");
      metaDescriptionLight?.setAttribute("content", "#fafafa");
    } else {
      const themeColor = getCSSVar("--theme-color");
      metaDescriptionDark?.setAttribute("content", themeColor);
      metaDescriptionLight?.setAttribute("content", themeColor);
    }
  }, [config.theme]);
}

function useHtmlLang() {
  useEffect(() => {
    const lang = getISOLang();
    const htmlLang = document.documentElement.lang;

    if (lang !== htmlLang) {
      document.documentElement.lang = lang;
    }
  }, []);
}

const useHasHydrated = () => {
  const [hasHydrated, setHasHydrated] = useState<boolean>(false);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  return hasHydrated;
};

const loadAsyncGoogleFont = () => {
  const linkEl = document.createElement("link");
  const proxyFontUrl = "/google-fonts";
  const remoteFontUrl = "https://fonts.googleapis.com";
  const googleFontUrl =
    getClientConfig()?.buildMode === "export" ? remoteFontUrl : proxyFontUrl;
  linkEl.rel = "stylesheet";
  linkEl.href =
    googleFontUrl +
    "/css2?family=" +
    encodeURIComponent("Noto Sans:wght@300;400;700;900") +
    "&display=swap";
  document.head.appendChild(linkEl);
};

function Screen() {
  const config = useAppConfig();
  const location = useLocation();
  const isHome = location.pathname === Path.Home;
  const isAuth = location.pathname === Path.Auth;
  const isMobileScreen = useMobileScreen();
  const shouldTightBorder =
    config.tightBorder && !isMobileScreen && !getClientConfig()?.isApp;

  useEffect(() => {
    loadAsyncGoogleFont();
  }, []);

  return (
    <div
      className={
        styles.container +
        ` ${shouldTightBorder ? styles["tight-container"] : styles.container} ${getLang() === "ar" ? styles["rtl-screen"] : ""
        }`
      }
    >
      {isAuth ? (
        <>
          <AuthPage />
        </>
      ) : (
        <>
          <SideBar className={isHome ? styles["sidebar-show"] : ""} />

          <div className={styles["window-content"]} id={SlotID.AppBody}>
            <Routes>
              <Route path={Path.Home} element={<Chat />} />
              <Route path={Path.NewChat} element={<NewChat />} />
              <Route path={Path.Masks} element={<MaskPage />} />
              <Route path={Path.Chat} element={<Chat />} />
              <Route path={Path.Settings} element={<Settings />} />
            </Routes>
          </div>
        </>
      )}
    </div>
  );
}

export function useLoadData() {
  const config = useAppConfig();

  useEffect(() => {
    (async () => {
      const models = await api.llm.models();
      config.mergeModels(models);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
interface Model {
  id: string;
}
export function Home() {
  useSwitchTheme();
  useLoadData();
  useHtmlLang();

  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const { data, isError } = useBalance({
    address: address
  })

  const searchParams = useSearchParams();
  const [apiKey, setApiKey] = useState('');
  const [message, setMessage] = useState('');
  const [models, setModels] = useState<Model[]>([]); // State to store model names
  const [selectedModel, setSelectedModel] = useState(''); // State to store the selected model ID
  const [inputText, setInputText] = useState(''); // State to store the entered text
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    console.log("[Config] got config from build time", getClientConfig());
    useAccessStore.getState().fetch();
  }, []);

  useEffect(() => {

    const storedApiKey = window.localStorage.getItem('apiKey');
    if (storedApiKey) {
      setApiKey(storedApiKey);
    }

    async function fetchApiData() {
      // Check for the code in the URL query parameters
      const code = searchParams.get('code');

      if (code) {
        const apiRoute = '/api/oauth'; // Adjust to your API route

        // Prepare the request options
        const requestOptions = {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code })
        };

        try {
          // Fetch data from your API route
          const response = await fetch(apiRoute, requestOptions);
          const data = await response.json();
          // Handle the data from the API
          console.log('Token or response received:', data);
          if (data.key) {
            // Store the key in localStorage and update state
            // window.localStorage.setItem('apiKey', data.key);
            // setApiKey(data.key);
          }
        } catch (error) {
          // Handle any errors here
          console.error('Error fetching data:', error);
        }
      }
    }

    async function fetchModels() {
      try {
        const response = await fetch('https://openrouter.ai/api/v1/models');
        const data = await response.json();
        setModels(data.data);

        if (data.data.length > 0) {
          setSelectedModel(data.data[0].id);
        }
      } catch (error) {
        console.error("Error fetching models:", error);
      }
    }

    fetchApiData();
    fetchModels();

  }, [searchParams]);


  if (!useHasHydrated()) {
    return <Loading />;
  }

  const openRouterAuth = () => {
    window.open('https://openrouter.ai/auth?callback_url=http://localhost:3000/')
  }

  const getCompletionsResponse = async () => {
    setIsLoading(true);

    const apiRoute = '/api/completions';

    const requestBody = {
      apiKey,
      model: selectedModel,
      text: inputText,
    };

    const requestOptions = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    };

    try {
      // Fetch data from your API route
      const response = await fetch(apiRoute, requestOptions);
      const data = await response.json();
      // Handle the data from the API
      const messageResponse = data.choices[0].message.content
      setMessage(messageResponse)
      setIsLoading(false);

    } catch (error) {
      // Handle any errors here
      console.error('Error fetching data:', error);
      setIsLoading(false)
    }
  }

  const handleModelChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedModel(event.target.value); // Update the selectedModel state with the new value
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(event.target.value); // Update the inputText state with the new value
  };


  return (
    <GoogleOAuthProvider clientId="712711246254-novdfqffvc0a90r4efagvo14semrnsgo.apps.googleusercontent.com">
        {/* {isConnected ?
          <ConnectButton/>
          :
          <></>
        }
        {isConnected ? (
          <> */}
            <ErrorBoundary>
              <Router>
                <Screen />
              </Router>
            </ErrorBoundary>
          {/* </>
        ) : (
          // If API Key is not created show this component to login through OpenRouter
          <>
            <div className="w-full text-center border-b border-gray-300 bg-gradient-to-b from-white to-gray-100 pb-8 pt-10 backdrop-blur-lg dark:border-neutral-700 dark:bg-gray-900/80 dark:from-gray-800/80 lg:rounded-xl lg:border lg:p-6 lg:dark:bg-gray-800/80">
              <p className='text-gray-800 dark:text-gray-200 text-lg font-light leading-relaxed mx-4'>
                Login Metamask to get instant access to all OpenRouter Models with a quick log-in.
              </p>
              <div className="mt-8 w-full flex justify-center">
              <ConnectButton/>
              </div>
            </div> */}
          {/* </> */}
        {/* )} */}
    </GoogleOAuthProvider>
  );
}
