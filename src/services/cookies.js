export async function getCookies(url) {
  return chrome.cookies.getAll({
    url,
  });
}

export async function removeCookies(cookies) {
  await Promise.all(
    cookies.map(async (cookie) => {
      const protocol = cookie.secure ? "https" : "http";

      const url = `${protocol}://${cookie.domain.replace(
        /^\./,
        "",
      )}${cookie.path}`;

      try {
        await chrome.cookies.remove({
          url,
          name: cookie.name,
        });
      } catch {}
    }),
  );
}

export async function setCookies(cookies) {
  await Promise.all(
    cookies.map(async (cookie) => {
      try {
        await chrome.cookies.set({
          url: cookie.secure
            ? `https://${cookie.domain.replace(/^\./, "")}${cookie.path}`
            : `http://${cookie.domain.replace(/^\./, "")}${cookie.path}`,

          name: cookie.name,

          value: cookie.value,

          domain: cookie.domain,

          path: cookie.path,

          secure: cookie.secure,

          httpOnly: cookie.httpOnly,

          sameSite: cookie.sameSite,

          expirationDate: cookie.expirationDate,
        });
      } catch {}
    }),
  );
}
