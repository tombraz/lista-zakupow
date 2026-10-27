import { Navigate, type RouteObject } from "react-router";
import { SignInScreen } from "./screens/SC-01-logowanie/SignInScreen";
import { SignUpScreen } from "./screens/SC-02-rejestracja/SignUpScreen";
import { TermsScreen } from "./screens/SC-04-regulamin/TermsScreen";
import { ListsScreen } from "./screens/SC-05-moje-listy/ListsScreen";
import { AccountScreen } from "./screens/SC-09-konto/AccountScreen";
import { PublicOnly, RequireSession } from "./session/guards";

// ia.md, „Ekrany”: SC-01–SC-04 publiczne, reszta wymaga zalogowania.
export const routes: RouteObject[] = [
  {
    element: <PublicOnly />,
    children: [
      { path: "/logowanie", element: <SignInScreen /> },
      { path: "/rejestracja", element: <SignUpScreen /> },
    ],
  },
  { path: "/regulamin", element: <TermsScreen /> },
  {
    element: <RequireSession />,
    children: [
      { path: "/listy", element: <ListsScreen /> },
      { path: "/konto", element: <AccountScreen /> },
      { path: "*", element: <Navigate to="/listy" replace /> },
    ],
  },
];
