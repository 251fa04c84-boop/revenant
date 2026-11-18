/** A deliberately haunted manifest so people can see Revenant work in one click. */
export const EXAMPLE_MANIFEST = JSON.stringify(
  {
    name: 'haunted-storefront',
    version: '0.4.2',
    dependencies: {
      express: '^4.21.0',
      request: '^2.88.2',
      moment: '^2.29.4',
      'node-uuid': '^1.4.8',
      'popper.js': '^1.16.1',
      faker: '^5.5.3',
      'left-pad': '^1.3.0',
      zod: '^3.23.8',
    },
    devDependencies: {
      'node-sass': '^7.0.3',
      tslint: '^6.1.3',
      'react-scripts': '^5.0.1',
      typescript: '^5.6.0',
    },
  },
  null,
  2,
);
