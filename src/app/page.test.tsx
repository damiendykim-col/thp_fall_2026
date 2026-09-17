import { render, screen } from "@testing-library/react";

import Home from "./page";

describe("Home page", () => {
  it("renders the Hello World heading", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { level: 1, name: /hello world/i }),
    ).toBeInTheDocument();
  });
});
