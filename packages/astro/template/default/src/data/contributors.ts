export type Contributor = {
  username: string;
  name?: string;
  avatarUrl: string;
  profileUrl: string;
  contributions?: number;
};

export const contributors: Contributor[] = [
  {
    username: "tortuvshin",
    name: "Tortuvshin",
    avatarUrl: "https://avatars.githubusercontent.com/u/9257227?v=4",
    profileUrl: "https://github.com/tortuvshin",
    contributions: 1,
  },
];
