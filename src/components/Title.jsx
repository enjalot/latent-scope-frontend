import { Helmet } from 'react-helmet';

const Title = ({ title, suffix = 'Latent Scope' }) => {
  const fullTitle = suffix ? `${title} | ${suffix}` : title;

  return (
    <Helmet>
      <title>{fullTitle}</title>
    </Helmet>
  );
};

export default Title;
