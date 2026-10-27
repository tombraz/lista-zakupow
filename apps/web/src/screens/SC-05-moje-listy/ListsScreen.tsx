import { AppBar, AppBarLink } from "../../components/AppBar/AppBar";
import { messages } from "./messages";

/** Szkielet SC-05: pasek z „Konto”; listy dochodzą w T-005. */
export function ListsScreen() {
  return (
    <>
      <AppBar
        title={messages.title}
        actions={<AppBarLink to="/konto" label={messages.account} icon="👤" />}
      />
      <main />
    </>
  );
}
