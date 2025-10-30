import { json } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { authenticate } from "../shopify.server";
import { useState, useCallback } from "react";
import { Frame, Toast } from "@shopify/polaris";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  return json({ apiKey: process.env.SHOPIFY_API_KEY || "" });
};

export default function App() {
  const { apiKey } = useLoaderData();
  const [toast, setToast] = useState({ active: false, content: '', error: false });

  const showToast = useCallback((content, error = false) => {
    setToast({ active: true, content, error });
  }, []);

  const toastMarkup = toast.active ? (
    <Toast content={toast.content} error={toast.error} onDismiss={() => setToast({ ...toast, active: false })} />
  ) : null;

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      <Frame>
        <NavMenu>
          <Link to="/app" rel="home">
            Home
          </Link>
          <Link to="/app/products">Products</Link>
          <Link to="/app/additional">Additional page</Link>
        </NavMenu>
        <Outlet context={{ showToast }} />
        {toastMarkup}
      </Frame>
    </AppProvider>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
