import { NewPasswordStep } from "./NewPasswordStep";
import { RequestLinkStep } from "./RequestLinkStep";
import { useResetToken } from "./useResetToken";

/** SC-03: krok 1 (prośba o link) albo krok 2 (nowe hasło), gdy wejście z linku z tokenem. */
export function PasswordResetScreen() {
  const token = useResetToken();
  return token === null ? <RequestLinkStep /> : <NewPasswordStep token={token} />;
}
