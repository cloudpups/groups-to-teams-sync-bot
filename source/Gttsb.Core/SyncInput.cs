﻿namespace Gttsb.Core
{
    public sealed class SyncInput
    {
        public IEnumerable<string> GitHubTeamNames { get; set; }        
        public string EmailAppend { get; set; } = String.Empty;
        public IEnumerable<string> EmailTextToReplaceRules { get; set; }
        public string OrganizationMembersGroup { get; set; }
        public bool CreateDeployment { get; set; } = true;
    };
}