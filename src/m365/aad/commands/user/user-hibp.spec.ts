import * as assert from 'assert';
import * as sinon from 'sinon';
import { telemetry } from '../../../../telemetry';
import { Cli } from '../../../../cli/Cli';
import { CommandInfo } from '../../../../cli/CommandInfo';
import { Logger } from '../../../../cli/Logger';
import { CommandError } from '../../../../Command';
import request from '../../../../request';
import { formatting } from '../../../../utils/formatting';
import { pid } from '../../../../utils/pid';
import { session } from '../../../../utils/session';
import { sinonUtil } from '../../../../utils/sinonUtil';
import commands from '../../commands';
const command = require('./user-hibp');

describe(commands.USER_HIBP, () => {
  let cli: Cli;
  let log: string[];
  let logger: Logger;
  let loggerLogSpy: sinon.SinonSpy;
  let commandInfo: CommandInfo;

  before(() => {
    cli = Cli.getInstance();
    commandInfo = Cli.getCommandInfo(command);
    sinon.stub(telemetry, 'trackEvent').returns();
    sinon.stub(pid, 'getProcessName').returns('');
    sinon.stub(session, 'getId').returns('');
  });

  beforeEach(() => {
    log = [];
    logger = {
      log: (msg: string) => {
        log.push(msg);
      },
      logRaw: (msg: string) => {
        log.push(msg);
      },
      logToStderr: (msg: string) => {
        log.push(msg);
      }
    };
    loggerLogSpy = sinon.spy(logger, 'log');
    sinon.stub(cli, 'getSettingWithDefaultValue').callsFake(((settingName, defaultValue) => defaultValue));
  });

  afterEach(() => {
    sinonUtil.restore([
      request.get,
      cli.getSettingWithDefaultValue
    ]);
  });

  after(() => {
    sinon.restore();
  });

  it('has correct name', () => {
    assert.strictEqual(command.name, commands.USER_HIBP);
  });

  it('has a description', () => {
    assert.notStrictEqual(command.description, null);
  });

  it('fails validation if userName and apiKey is not specified', async () => {
    const actual = await command.validate({ options: {} }, commandInfo);
    assert.notStrictEqual(actual, true);
  });

  it('fails validation if the userName is not a valid UPN', async () => {
    const actual = await command.validate({ options: { userName: 'invalid', apiKey: 'key' } }, commandInfo);
    assert.notStrictEqual(actual, true);
  });

  it('passes validation if userName and apiKey is specified', async () => {
    const actual = await command.validate({ options: { userName: "account-exists@hibp-integration-tests.com", apiKey: "2975xc539c304xf797f665x43f8x557x" } }, commandInfo);
    assert.strictEqual(actual, true);
  });

  it('passes validation if domain is specified', async () => {
    const actual = await command.validate({ options: { userName: "account-exists@hibp-integration-tests.com", apiKey: "2975xc539c304xf797f665x43f8x557x", domain: "domain.com" } }, commandInfo);
    assert.strictEqual(actual, true);
  });

  it('checks user is pwned using userName', async () => {
    sinon.stub(request, 'get').callsFake(async (opts) => {
      if (opts.url === `https://haveibeenpwned.com/api/v3/breachedaccount/${formatting.encodeQueryParameter('account-exists@hibp-integration-tests.com')}`) {
        return [{ "Name": "Adobe" }];
      }

      throw 'Invalid request';
    });

    await command.action(logger, { options: { userName: 'account-exists@hibp-integration-tests.com', apiKey: "2975xc539c304xf797f665x43f8x557x" } });
    assert(loggerLogSpy.calledWith([{ "Name": "Adobe" }]));
  });

  it('checks user is pwned using userName (debug)', async () => {
    sinon.stub(request, 'get').callsFake(async (opts) => {
      if (opts.url === `https://haveibeenpwned.com/api/v3/breachedaccount/${formatting.encodeQueryParameter('account-exists@hibp-integration-tests.com')}`) {
        // this is the actual truncated response as the API would return
        return [{ "Name": "Adobe" }];
      }

      throw 'Invalid request';
    });

    await command.action(logger, { options: { debug: true, userName: 'account-exists@hibp-integration-tests.com', apiKey: '2975xc539c304xf797f665x43f8x557x' } });
    assert(loggerLogSpy.calledWith([{ "Name": "Adobe" }]));
  });

  it('checks user is pwned using userName and multiple breaches', async () => {
    sinon.stub(request, 'get').callsFake(async (opts) => {
      if (opts.url === `https://haveibeenpwned.com/api/v3/breachedaccount/${formatting.encodeQueryParameter('account-exists@hibp-integration-tests.com')}`) {
        // this is the actual truncated response as the API would return
        return [{ "Name": "Adobe" }, { "Name": "Gawker" }, { "Name": "Stratfor" }];
      }

      throw 'Invalid request';
    });

    await command.action(logger, { options: { userName: 'account-exists@hibp-integration-tests.com', apiKey: "2975xc539c304xf797f665x43f8x557x" } });
    assert(loggerLogSpy.calledWith([{ "Name": "Adobe" }, { "Name": "Gawker" }, { "Name": "Stratfor" }]));
  });

  it('checks user is pwned using userName and domain', async () => {
    sinon.stub(request, 'get').callsFake(async (opts) => {
      if (opts.url === `https://haveibeenpwned.com/api/v3/breachedaccount/${formatting.encodeQueryParameter('account-exists@hibp-integration-tests.com')}?domain=adobe.com`) {
        // this is the actual truncated response as the API would return
        return [{ "Name": "Adobe" }];
      }

      throw 'Invalid request';
    });

    await command.action(logger, { options: { userName: 'account-exists@hibp-integration-tests.com', domain: "adobe.com", apiKey: "2975xc539c304xf797f665x43f8x557x" } });
    assert(loggerLogSpy.calledWith([{ "Name": "Adobe" }]));
  });

  it('checks user is pwned using userName and domain with a domain that does not exists', async () => {
    sinon.stub(request, 'get').callsFake(async (opts) => {
      if (opts.url === `https://haveibeenpwned.com/api/v3/breachedaccount/${formatting.encodeQueryParameter('account-exists@hibp-integration-tests.com')}?domain=adobe.xxx`) {
        // this is the actual truncated response as the API would return
        throw {
          "response": {
            "status": 404
          }
        };
      }

      throw 'Invalid request';
    });

    await command.action(logger, { options: { debug: true, userName: 'account-exists@hibp-integration-tests.com', domain: "adobe.xxx", apiKey: "2975xc539c304xf797f665x43f8x557x" } });
    assert(loggerLogSpy.calledWith("No pwnage found"));
  });

  it('correctly handles no pwnage found (debug)', async () => {
    sinon.stub(request, 'get').rejects({
      "response": {
        "status": 404
      }
    });

    await command.action(logger, { options: { debug: true, userName: 'account-notexists@hibp-integration-tests.com', apiKey: "2975xc539c304xf797f665x43f8x557x" } });
    assert(loggerLogSpy.calledWith("No pwnage found"));
  });

  it('correctly handles no pwnage found (verbose)', async () => {
    sinon.stub(request, 'get').rejects({
      "response": {
        "status": 404
      }
    });

    await command.action(logger, { options: { verbose: true, userName: 'account-notexists@hibp-integration-tests.com', apiKey: "2975xc539c304xf797f665x43f8x557x" } });
    assert(loggerLogSpy.calledWith("No pwnage found"));
  });

  it('correctly handles unauthorized request', async () => {
    sinon.stub(request, 'get').rejects(new Error("Access denied due to improperly formed hibp-api-key."));

    await assert.rejects(command.action(logger, { options: { userName: 'account-notexists@hibp-integration-tests.com' } } as any),
      new CommandError("Access denied due to improperly formed hibp-api-key."));
  });

  it('fails validation if the userName is not a valid UPN.', async () => {
    const actual = await command.validate({
      options: {
        userName: "no-an-email"
      }
    }, commandInfo);
    assert.notStrictEqual(actual, true);
  });
});
