import { Config } from "../config";
import ldap from "ldapjs";
import ldapEscape from "ldap-escape";
import axios from "axios";
import axiosRetry from "axios-retry";
import { Log } from "../logging";

const config = Config()

let client: ldap.Client;

if(!process.env.SOURCE_PROXY) {
    client = ldap.createClient({
        url: [config.LDAP.Server]
    });
    
    client.bind(config.LDAP.User, config.LDAP.Password, (err) => {
        Log(err);
    });
}
else {
    Log("Group Proxy is set. LDAP will not be configured for this instance.")
}

function SearchAsync(groupName: string): Promise<any> {
    const component = ldapEscape.filter`${groupName}`;
    const ldapSearchString = `(&(objectCategory=user)(memberOf=CN=${component},CN=Users,${config.LDAP.GroupBaseDN}))`

    const opts: ldap.SearchOptions = {
        filter: ldapSearchString,
        scope: "sub",
        // paged:true
        attributes: ['dn', 'cn', 'userPrincipalName'],
        // paged: {
        //     pageSize: 250,
        //     pagePause: true
        //   }
    };

    return new Promise((resolve, reject) => {
        client.search(config.LDAP.GroupBaseDN, opts, (err, res) => {
            if (err) {
                return reject(err);
            }

            return resolve(res);
        });
    })
}

export interface Entry {
    cn: string,
    userPrincipalName: string
}

export type SearchAllFailed = {
    Succeeded: false
}

export type SearchAllSucceeded = {
    Succeeded: true,
    entries: Entry[],
    referrals: any[]
}

export type SearchAllResponse = Promise<SearchAllFailed | SearchAllSucceeded>

async function SearchAllAsyncNoExceptionHandling(groupName: string): SearchAllResponse {
    // TODO: implement paging somehow!!
    const response = await SearchAsync(groupName);

    const entries: Entry[] = [];
    let referrals: any[] = [];

    return new Promise((resolve, reject) => {
        // res.on('searchRequest', (searchRequest) => {
        //     Log('searchRequest: ', searchRequest.messageId);
        // });

        response.on('searchEntry', (entry: any) => {
            const attributes = entry.pojo.attributes.map((a: any) => {
                return [
                    a.type,
                    a.values[0]
                ]
            })
            entries.push(Object.fromEntries(attributes) as Entry);
        });

        response.on('searchReference', (referral: any) => {
            referrals = referrals.concat(referral.uris);
        });

        response.on('end', (result: any) => {
            if (result.status !== 0) {
                return reject(result.status);
            }

            return resolve({
                entries: entries,
                referrals: referrals,
                Succeeded: true
            });
        });

        response.on('error', (err: any) => {
            Log('error: ' + err.message);
            return reject();
        });

        // response.on('error', (error:any) => {
        //     if (error.name === 'SizeLimitExceededError' &&
        //         options.sizeLimit && options.sizeLimit > 0) {
        //         return resolve(entries);
        //     } else {
        //         return reject(error);
        //     }
        // })
    });
}         

export async function SearchAllAsync(groupName: string): SearchAllResponse {
    try {
        if(process.env.SOURCE_PROXY) {
            return await ForwardSearch(groupName);
        }
    
        return await SearchAllAsyncNoExceptionHandling(groupName);
    }
    catch(ex: any) {
        Log(ex);
        
        return {
            Succeeded: false
        }
    }
}

async function ForwardSearch(groupName: string) : SearchAllResponse  {
    Log(`Forwarding request to '${process.env.SOURCE_PROXY}'`);
    
    // cb is for cache busting.
    const requestUrl = `${process.env.SOURCE_PROXY}/api/get-source-team?teamName=${groupName}&cb=${Date.now()}`;

    Log(`Retrieving group (${groupName}) information from '${requestUrl}'`);
    try{
        // TODO: do not directly use axios.create from within a function like this
        // it will cause a new client to be made per request.
        const client = axios.create();
        axiosRetry(client, { retries: 5 });

        const result = await client.get(requestUrl);
        Log(`Results for ${groupName}: ${result}`);
        return result.data as SearchAllResponse;
    }    
    catch(e) {        
        Log(`Error when retrieving results for ${groupName}: ${e}`);
    }
    
    return {
        Succeeded: false
    }
}
