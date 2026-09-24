import { fireEvent, render, screen } from "@testing-library/react";
import Gallery from "./images/gallery";

const images = [
  { id: "older", image_url: "https://example.com/older.gif", description: "", created_at: "2026-09-23T00:00:00Z" },
  { id: "newer", image_url: "https://example.com/newer.gif", description: "A surprised character", created_at: "2026-09-24T00:00:00Z" },
];

describe("Image gallery", () => {
  it("sorts by date and renders images even without descriptions", () => {
    render(<Gallery images={images} />);
    expect(screen.getAllByRole("img")[0]).toHaveAttribute("src", images[1].image_url);
    expect(screen.getByAltText("Community meme")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "oldest" } });
    expect(screen.getAllByRole("img")[0]).toHaveAttribute("src", images[0].image_url);
  });

  it("switches between cards, list, and table while preserving sort order", () => {
    render(<Gallery images={images} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "oldest" } });
    fireEvent.click(screen.getByRole("button", { name: "List", exact: true }));
    expect(screen.getByText("Untitled image")).toBeInTheDocument();
    expect(screen.getAllByRole("img")[0]).toHaveAttribute("src", images[0].image_url);
    fireEvent.click(screen.getByRole("button", { name: "Table", exact: true }));
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(3);
    expect(screen.getAllByRole("img")[0]).toHaveAttribute("src", images[0].image_url);
    fireEvent.click(screen.getByRole("button", { name: "Cards", exact: true }));
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cards", exact: true })).toHaveAttribute("aria-pressed", "true");
  });

  it("shows an empty state", () => {
    render(<Gallery images={[]} />);
    expect(screen.getByText(/No images yet/)).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("shows a fallback when an image fails to load", () => {
    render(<Gallery images={images} />);
    fireEvent.error(screen.getAllByRole("img")[0]);
    expect(screen.getByText("This image couldn’t load.")).toBeInTheDocument();
  });
});
