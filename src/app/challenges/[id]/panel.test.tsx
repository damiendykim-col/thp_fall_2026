import { act, render } from "@testing-library/react";
import { useRouter } from "next/navigation";
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
