import { jest } from '@jest/globals';

const pushMock = jest.fn();
const router = {
  push: pushMock,
};

export const useRouter = jest.fn().mockImplementation(() => router);
