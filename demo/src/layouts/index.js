import styles from './index.css';
import withRouter from 'umi/withRouter';



function BasicLayout(props) {
  return (
    <div className={styles.normal}>
      <h1 className={styles.title}>Yay! Welcome to umi!</h1>
      { props.children }
    </div>
  );
}

export default withRouter(BasicLayout);
