import * as assert from 'assert';
import * as sinon from 'sinon';
import { telemetry } from '../../../../telemetry';
import auth from '../../../../Auth';
import { Cli } from '../../../../cli/Cli';
import { CommandInfo } from '../../../../cli/CommandInfo';
import { Logger } from '../../../../cli/Logger';
import Command, { CommandError } from '../../../../Command';
import request from '../../../../request';
import { pid } from '../../../../utils/pid';
import { session } from '../../../../utils/session';
import { sinonUtil } from '../../../../utils/sinonUtil';
import commands from '../../commands';
const command: Command = require('./group-add');

const validSharePointUrl = 'https://contoso.sharepoint.com/sites/project-x';
const validName = 'Project leaders';

const groupAddedResponse = {
  Id: 1,
  Title: validName,
  AllowMembersEditMembership: false,
  AllowRequestToJoinLeave: false,
  AutoAcceptRequestToJoinLeave: false,
  Description: 'Lorem ipsum',
  OnlyAllowMembersViewMembership: false,
  RequestToJoinLeaveEmailSetting: 'john.doe@contoso.com'
};

describe(commands.GROUP_ADD, () => {
  let log: any[];
  let logger: Logger;
  let loggerLogSpy: sinon.SinonSpy;
  let commandInfo: CommandInfo;

  before(() => {
    sinon.stub(auth, 'restoreAuth').resolves();
    sinon.stub(telemetry, 'trackEvent').returns();
    sinon.stub(pid, 'getProcessName').returns('');
    sinon.stub(session, 'getId').returns('');
    auth.service.connected = true;
    commandInfo = Cli.getCommandInfo(command);
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
  });

  afterEach(() => {
    sinonUtil.restore([
      request.post
    ]);
  });

  after(() => {
    sinon.restore();
    auth.service.connected = false;
  });

  it('has correct name', () => {
    assert.strictEqual(command.name, commands.GROUP_ADD);
  });

  it('has a description', () => {
    assert.notStrictEqual(command.description, null);
  });

  it('fails validation if the url option is not a valid SharePoint site URL', async () => {
    const actual = await command.validate({ options: { webUrl: 'foo', name: validName } }, commandInfo);
    assert.notStrictEqual(actual, true);
  });

  it('passes validation if the url is valid and name is passed', async () => {
    const actual = await command.validate({ options: { webUrl: validSharePointUrl, name: validName } }, commandInfo);
    assert.strictEqual(actual, true);
  });

  it('correctly adds group to site', async () => {
    sinon.stub(request, 'post').callsFake(async (opts) => {
      if (opts.url === `${validSharePointUrl}/_api/web/sitegroups`) {
        return groupAddedResponse;
      }

      throw 'Invalid request';
    });

    await command.action(logger, {
      options: {
        webUrl: validSharePointUrl,
        name: validName
      }
    });
    assert(loggerLogSpy.calledWith(groupAddedResponse));
  });

  it('correctly handles API OData error', async () => {
    const error = {
      error: {
        'odata.error': {
          code: '-1, Microsoft.SharePoint.Client.InvalidOperationException',
          message: {
            value: 'An error has occurred'
          }
        }
      }
    };
    sinon.stub(request, 'post').rejects(error);

    await assert.rejects(command.action(logger, { options: {} } as any), new CommandError(error.error['odata.error'].message.value));
  });
}); 
