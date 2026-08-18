import handler from "./handler.mjs";

export default (request, response) => {
  const path = new URL(request.url, "http://localhost").searchParams.get("path");
  if (path) request.url = path;
  return handler(request, response);
};
