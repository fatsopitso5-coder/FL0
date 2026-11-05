import "./globals.css";

export const metadata = {
  title: "FL0 MVP1",
  description: "Local proof-of-concept for conversational PDF completion",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
