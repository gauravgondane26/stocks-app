import Link from "next/link";

// A link, or a button when `onClick` is given (inside the sign-in dialog).
const FooterLink = ({ text, linkText, href, onClick }: FooterLinkProps) => {
  return (
    <p className="pt-4 text-center text-sm text-gray-500">
      {text}{" "}
      {onClick ? (
        <button type="button" onClick={onClick} className="footer-link cursor-pointer">
          {linkText}
        </button>
      ) : (
        <Link href={href ?? "/"} className="footer-link">
          {linkText}
        </Link>
      )}
    </p>
  );
};

export default FooterLink;
