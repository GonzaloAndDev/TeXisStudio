import { useHelpStore, type HelpSection } from "../../stores/help";
import { useTranslation } from "react-i18next";

interface Props {
  topic: HelpSection;
  style?: React.CSSProperties;
}

export function HelpLink({ topic, style }: Props) {
  const { openHelp } = useHelpStore();
  const { t } = useTranslation();
  return (
    <button
      className="btn btn-ghost btn-icon"
      onClick={() => openHelp(topic)}
      title={t("help.open_help")}
      style={{ fontSize: 11, padding: "2px 6px", lineHeight: 1, color: "var(--fg-faint)", ...style }}
    >
      ?
    </button>
  );
}
