import { jest } from '@jest/globals';

const pushMock = jest.fn();
const refreshMock = jest.fn();
const router = {
  push: pushMock,
  // useTransitionWrapper calls refresh() after every mutation, so a mock without it
  // makes the wrapper throw — which surfaces as a component's own error branch
  // firing on the success path, or as an unhandled rejection nothing asserts on.
  refresh: refreshMock,
};

export const useRouter = jest.fn().mockImplementation(() => router);
