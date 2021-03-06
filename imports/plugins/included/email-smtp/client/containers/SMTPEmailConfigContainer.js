import React, { Component } from "react";
import PropTypes from "prop-types";
import getServiceConfig from "nodemailer-wellknown";
import { withApollo } from "react-apollo";
import { compose, withProps } from "recompose";
import { composeWithTracker } from "@reactioncommerce/reaction-components";
import { Meteor } from "meteor/meteor";
import { Packages } from "/lib/collections";
import { Reaction } from "/client/api";
import actions from "../actions";
import SMTPEmailConfig from "../components/SMTPEmailConfig";
import gql from "graphql-tag";
import getOpaqueIds from "/imports/plugins/core/core/client/util/getOpaqueIds";

const verifySMTPEmailSettings = gql`
  mutation verifySMTPEmailSettings($input: VerifySMTPEmailSettingsInput!) {
    verifySMTPEmailSettings(input: $input) {
      clientMutationId
      isVerified
    }
  }
`;

const wrapComponent = (Comp) => (
  class SMTPEmailConfigContainer extends Component {
    static propTypes = {
      client: PropTypes.shape({
        mutate: PropTypes.func.isRequired
      }),
      settings: PropTypes.shape({
        host: PropTypes.string,
        password: PropTypes.string,
        port: PropTypes.oneOfType([
          PropTypes.number,
          PropTypes.string
        ]),
        service: PropTypes.string,
        user: PropTypes.string
      })
    }

    constructor(props) {
      super(props);
      this.state = {
        status: "error",
        error: null
      };
    }

    componentDidMount() {
      this._isMounted = true;
      this.checkEmailStatus();
    }

    // eslint-disable-next-line camelcase
    UNSAFE_componentWillReceiveProps(nextProps) {
      const { settings } = this.props;
      const { settings: nextSettings } = nextProps;
      // if the email settings do not match check the email status
      if (JSON.stringify(settings) !== JSON.stringify(nextSettings)) {
        this.checkEmailStatus();
      } else {
        return;
      }
    }

    componentWillUnmount() {
      this._isMounted = false;
    }

    // checking email settings
    // and updating status
    checkEmailStatus = async () => {
      const { client, settings } = this.props;
      const { service, host, port, user, password } = settings;

      if (host && password && port && service && user) {
        const shopId = Reaction.getPrimaryShopId();
        const [opaqueShopId] = await getOpaqueIds([{ namespace: "Shop", id: shopId }]);

        const { data } = await client.mutate({
          mutation: verifySMTPEmailSettings,
          variables: {
            input: {
              host,
              password,
              port,
              service,
              shopId: opaqueShopId,
              user
            }
          }
        });

        if (data) {
          this.setState({ status: "valid" });
        }
      }
    }

    render() {
      const { status } = this.state;
      return (
        <Comp {...this.props} status={status} />
      );
    }
  }
);

const composer = (props, onData) => {
  const shopId = Reaction.getShopId();
  if (!shopId) return;

  const pkgSub = Meteor.subscribe("Packages", shopId);
  if (pkgSub.ready()) {
    const pkg = Packages.findOne({ name: "core", shopId }) || {};
    const shopSettings = pkg.settings || {};
    const settings = shopSettings.mail || {};

    if (settings.service && settings.service !== "custom") {
      const config = getServiceConfig(settings.service);

      // show localhost for test providers like Maildev that have no host
      settings.host = config.host || "localhost";
      settings.port = config.port;
    }

    onData(null, { settings });
  }
};

const handlers = { saveSettings: actions.settings.saveSettings };

export default compose(
  composeWithTracker(composer),
  withProps(handlers),
  withApollo,
  wrapComponent
)(SMTPEmailConfig);
