import { act, render, fireEvent } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { generateOpponent } from "../actions";
import ChallengePanel from "./panel";
jest.mock("next/navigation",()=>({useRouter:jest.fn()}));
jest.mock("../actions",()=>({generateOpponent:jest.fn(),publishChallenge:jest.fn(),voteChallenge:jest.fn()}));
afterEach(()=>jest.useRealTimers());
test("keeps checking authoritative results if the first deadline refresh is early",()=>{
  jest.useFakeTimers(); jest.setSystemTime(new Date("2026-10-07T00:01:00Z"));
  const refresh=jest.fn(); jest.mocked(useRouter).mockReturnValue({refresh} as unknown as ReturnType<typeof useRouter>);
  const c={id:"c",own:false,status:"published",situation:"scene",image_path:null,template_url:null,closes_at:"2026-10-07T00:00:00Z",closed:false,vote:null,captions:[]};
  const {rerender}=render(<ChallengePanel challenge={c}/>);
  expect(refresh).toHaveBeenCalledTimes(1);
  act(()=>jest.advanceTimersByTime(5000));
  expect(refresh).toHaveBeenCalledTimes(2);
  rerender(<ChallengePanel challenge={{...c,closed:true}}/>);
  act(()=>jest.advanceTimersByTime(10000));
  expect(refresh).toHaveBeenCalledTimes(2);
});

test.each([['draft', true], ['ready', true], ['failed', true], ['generating', false], ['published', false]])('editing is offered only for idle unpublished owners: %s', (status, editable) => {
  jest.mocked(useRouter).mockReturnValue({ refresh: jest.fn() } as unknown as ReturnType<typeof useRouter>);
  const c = { id: 'c', own: true, status, situation: 'scene', image_path: null, template_url: null, closes_at: null, closed: false, vote: null, captions: [] };
  const { queryByRole } = render(<ChallengePanel challenge={c} />);
  expect(Boolean(queryByRole('link', { name: 'Edit challenge' }))).toBe(editable);
});

test('a ready draft awaiting moderator approval cannot publish but can leave to another draft', () => {
  jest.mocked(useRouter).mockReturnValue({ refresh: jest.fn() } as unknown as ReturnType<typeof useRouter>);
  const c = { id: 'c', own: true, status: 'ready', situation: 'scene', image_path: null, template_url: null, closes_at: null, closed: false, vote: null, captions: [] };
  const { getByRole } = render(<ChallengePanel challenge={c} publicationBlocked />);
  expect(getByRole('button', { name: 'Publish for 24 hours' })).toBeDisabled();
  expect(getByRole('link', { name: 'Start another' })).toHaveAttribute('href', '/challenges/new');
  expect(getByRole('button', { name: 'Check review status' })).toBeEnabled();
});

test('an in-flight generation shows work without inventing a percentage', async () => {
  jest.mocked(useRouter).mockReturnValue({ refresh: jest.fn() } as unknown as ReturnType<typeof useRouter>);
  let finish!: (result: { error?: string }) => void;
  jest.mocked(generateOpponent).mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const c = { id: 'c', own: true, status: 'draft', situation: 'scene', image_path: null, template_url: null, closes_at: null, closed: false, vote: null, captions: [] };
  const { getByRole, queryByRole } = render(<ChallengePanel challenge={c} />);
  fireEvent.click(getByRole('button', { name: 'Generate AI opponent' }));
  expect(getByRole('status')).toHaveTextContent('Checking content and writing your opponent');
  expect(queryByRole('progressbar')).not.toBeInTheDocument();
  await act(async () => finish({}));
  expect(queryByRole('status')).not.toBeInTheDocument();
});
